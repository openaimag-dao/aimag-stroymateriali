-- Сотрудники компании: владелец приглашает по email, сотрудник присоединяется после входа с этим email.
-- Присоединиться «по БИН» нельзя (иначе чужие заказы увидит любой, кто знает БИН) — только по приглашению.

create table company_invites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  email       text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role        text not null default 'buyer' check (role in ('buyer', 'accountant')),
  invited_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);
-- одно открытое приглашение на адрес в компании
create unique index company_invites_open_idx on company_invites (company_id, email) where accepted_at is null;
create index company_invites_email_idx on company_invites (email) where accepted_at is null;

alter table company_invites enable row level security;
create policy company_invites_read on company_invites for select to authenticated
  using (company_id in (select my_company_ids()) or is_staff());
create policy company_invites_staff on company_invites for all to authenticated using (is_staff()) with check (is_staff());

-- компания, где пользователь — владелец
create or replace function my_owned_company() returns uuid
language sql stable security definer set search_path = public as
$$ select company_id from company_members where user_id = auth.uid() and role = 'owner' limit 1 $$;
revoke all on function my_owned_company() from public, anon;
grant execute on function my_owned_company() to authenticated;

create or replace function auth_email() returns text
language sql stable security definer set search_path = public, auth as
$$ select lower(email) from auth.users where id = auth.uid() $$;
revoke all on function auth_email() from public, anon, authenticated;

-- ── Владелец: пригласить, отозвать, убрать сотрудника ──
create or replace function invite_member(p_email text, p_role text default 'buyer') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := my_owned_company();
  v_email   text := lower(trim(p_email));
  v_id      uuid;
begin
  if v_company is null then raise exception 'not_owner'; end if;
  if p_role not in ('buyer', 'accountant') then raise exception 'bad_role'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email'; end if;
  if exists (select 1 from company_members m join auth.users u on u.id = m.user_id
             where m.company_id = v_company and lower(u.email) = v_email) then
    raise exception 'already_member';
  end if;
  if (select count(*) from company_invites where company_id = v_company and accepted_at is null) >= 20 then
    raise exception 'too_many_invites';
  end if;

  insert into company_invites (company_id, email, role, invited_by)
  values (v_company, v_email, p_role, auth.uid())
  on conflict (company_id, email) where accepted_at is null do update set role = excluded.role, created_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function revoke_invite(p_invite_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from company_invites
   where id = p_invite_id and accepted_at is null
     and (company_id = my_owned_company() or is_staff());
  if not found then raise exception 'invite_not_found'; end if;
end $$;

create or replace function remove_member(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_company uuid := my_owned_company();
begin
  if v_company is null then raise exception 'not_owner'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_remove_self'; end if;
  delete from company_members where company_id = v_company and user_id = p_user_id and role <> 'owner';
  if not found then raise exception 'member_not_found'; end if;
end $$;

-- ── Приглашённый: увидеть приглашения на свой email и принять ──
-- До вступления покупатель не видит компанию по RLS, поэтому название отдаёт функция.
create or replace function my_invites()
returns table (id uuid, company_name text, legal_form text, bin text, role text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, c.name, c.legal_form, c.bin, i.role, i.created_at
  from company_invites i join companies c on c.id = i.company_id
  where i.accepted_at is null and i.email = auth_email()
  order by i.created_at desc
$$;

create or replace function accept_invite(p_invite_id uuid, p_full_name text, p_phone text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_inv company_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_inv from company_invites
   where id = p_invite_id and accepted_at is null and email = auth_email()
   for update;
  if not found then raise exception 'invite_not_found'; end if;
  -- одна компания на пользователя: кабинет, корзина и документы привязаны к ней
  if exists (select 1 from company_members where user_id = auth.uid()) then raise exception 'already_in_company'; end if;
  if length(trim(coalesce(p_full_name, ''))) < 2 then raise exception 'bad_name'; end if;

  insert into company_members (company_id, user_id, full_name, phone, role)
  values (v_inv.company_id, auth.uid(), left(trim(p_full_name), 120), left(trim(p_phone), 30), v_inv.role);
  update company_invites set accepted_at = now(), accepted_by = auth.uid() where id = p_invite_id;
  return v_inv.company_id;
end $$;

-- Сотрудники своей компании с email (email хранится в auth.users, напрямую его не прочитать)
create or replace function my_company_members()
returns table (user_id uuid, full_name text, phone text, role text, email text, is_me boolean)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, m.full_name, m.phone, m.role, lower(u.email), m.user_id = auth.uid()
  from company_members m join auth.users u on u.id = m.user_id
  where m.company_id in (select my_company_ids())
  order by (m.role = 'owner') desc, m.full_name
$$;

do $$
declare f text;
begin
  foreach f in array array['invite_member(text, text)', 'revoke_invite(uuid)', 'remove_member(uuid)',
                           'my_invites()', 'accept_invite(uuid, text, text)', 'my_company_members()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
