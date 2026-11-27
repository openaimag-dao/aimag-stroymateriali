-- Приглашения персонала по email: строка ждёт, пока человек впервые войдёт с этим адресом,
-- и тогда пользователь автоматически получает роль в staff. Адреса хранятся только в базе.
create table staff_invites (
  email      text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role       text not null check (role in ('admin', 'manager')),
  created_at timestamptz not null default now()
);
alter table staff_invites enable row level security;
create policy staff_invites_staff on staff_invites for all to authenticated using (is_staff()) with check (is_staff());

create or replace function grant_invited_staff() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from staff_invites where email = lower(new.email);
  if v_role is not null then
    insert into staff (user_id, role) values (new.id, v_role)
    on conflict (user_id) do update set role = excluded.role;
    delete from staff_invites where email = lower(new.email);
  end if;
  return new;
end $$;
revoke all on function grant_invited_staff() from public, anon, authenticated;

create trigger on_auth_user_staff_invite
  after insert or update of email on auth.users
  for each row execute function grant_invited_staff();
