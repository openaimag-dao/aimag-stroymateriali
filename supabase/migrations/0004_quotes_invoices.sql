-- Выставление КП и счёта.
-- Цены считаются только здесь, из базы: клиент присылает лишь товары и количество,
-- поэтому подменить цену из браузера нельзя, а одна позиция стоит одинаково во всех КП.

-- ── Реквизиты продавца для счёта ───────────────────────────────
-- Банковские данные (ИИК, БИК) вносятся в базу через админку, не в код.
alter table sellers add column if not exists kbe text;                       -- код бенефициара
alter table sellers add column if not exists knp text not null default '710'; -- код назначения платежа

-- ── Нумерация документов: КП-ГГММДД-NN и ГГММДД-NN, счётчик на день по Алматы ──
create table doc_counters (
  kind  text not null check (kind in ('quote','invoice')),
  day   date not null,
  n     int  not null,
  primary key (kind, day)
);
alter table doc_counters enable row level security;  -- только через функцию ниже

create or replace function next_doc_number(p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'Asia/Almaty')::date;
  v_n   int;
begin
  insert into doc_counters (kind, day, n) values (p_kind, v_day, 1)
  on conflict (kind, day) do update set n = doc_counters.n + 1
  returning n into v_n;
  return case when p_kind = 'quote' then 'КП-' else '' end
         || to_char(v_day, 'YYMMDD') || '-' || lpad(v_n::text, 2, '0');
end $$;
revoke all on function next_doc_number(text) from public, anon, authenticated;

-- номер КП теперь выдаёт функция; старый годовой счётчик не нужен
alter table quotes alter column number drop default;
drop sequence if exists doc_number_seq;

alter table quotes add column if not exists goods_kzt numeric(14,2) not null default 0;
alter table quotes add column if not exists total_kzt numeric(14,2) not null default 0;
alter table quotes add column if not exists vat_kzt   numeric(14,2) not null default 0;
alter table quotes alter column valid_until set default ((now() at time zone 'Asia/Almaty')::date + 7);
alter table quote_items add column if not exists mark text;   -- тип/марка (ГОСТ, характеристики)

-- ── КП из корзины ──────────────────────────────────────────────
-- p_items: [{"product_id": "...", "qty": 12.5}, ...]
create or replace function create_quote(
  p_items jsonb,
  p_delivery_method text default 'pickup',
  p_delivery_city text default null,
  p_delivery_address text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_company  uuid;
  v_discount numeric;
  v_seller   smallint;
  v_quote    uuid;
  v_goods    numeric := 0;
  v_line     int := 0;
  v_item     jsonb;
  v_qty      numeric;
  v_p        products%rowtype;
  v_price    numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_delivery_method not in ('pickup','city','intercity') then raise exception 'bad_delivery'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_cart'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'too_many_lines'; end if;

  select m.company_id, c.personal_discount_pct into v_company, v_discount
  from company_members m join companies c on c.id = m.company_id
  where m.user_id = auth.uid()
  order by (m.role = 'owner') desc
  limit 1;
  if v_company is null then raise exception 'no_company'; end if;

  select id into v_seller from sellers where code = 'aimag';

  insert into quotes (number, company_id, seller_id, delivery_method, delivery_city, delivery_address, created_by)
  values (next_doc_number('quote'), v_company, v_seller, p_delivery_method,
          left(p_delivery_city, 120), left(p_delivery_address, 300), auth.uid())
  returning id into v_quote;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 1000000 then raise exception 'bad_qty'; end if;

    select * into v_p from products where id = (v_item->>'product_id')::uuid and is_active;
    if not found then raise exception 'product_unavailable'; end if;

    -- лучшая из оптовых цен, достигнутых по объёму, затем персональная скидка компании
    select least(v_p.price_kzt, coalesce(min(t.price_kzt), v_p.price_kzt)) into v_price
    from price_tiers t where t.product_id = v_p.id and t.min_qty <= v_qty;
    v_price := ceil(v_price * (1 - v_discount / 100));

    v_line := v_line + 1;
    insert into quote_items (quote_id, line_no, product_id, name, mark, unit, qty, price_kzt)
    values (v_quote, v_line, v_p.id, v_p.name, v_p.spec, v_p.unit, v_qty, v_price);
    v_goods := v_goods + round(v_qty * v_price);
  end loop;

  -- доставка (кроме самовывоза) добавляется менеджером после расчёта по весу и адресу
  update quotes
     set goods_kzt = v_goods,
         total_kzt = v_goods + delivery_kzt,
         vat_kzt   = round((v_goods + delivery_kzt) * 16 / 116)
   where id = v_quote;

  return v_quote;
end $$;

-- ── Счёт по КП ─────────────────────────────────────────────────
create or replace function issue_invoice(p_quote_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_q     quotes%rowtype;
  v_order uuid;
  v_iban  text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_q from quotes where id = p_quote_id;
  if not found or not (v_q.company_id in (select my_company_ids()) or is_staff()) then
    raise exception 'quote_not_found';
  end if;

  select id into v_order from orders where quote_id = p_quote_id;
  if v_order is not null then return v_order; end if;   -- счёт по КП выставляется один раз

  if v_q.valid_until < (now() at time zone 'Asia/Almaty')::date then raise exception 'quote_expired'; end if;

  select iban into v_iban from sellers where id = v_q.seller_id;
  if v_iban is null or v_iban = '' then raise exception 'seller_bank_missing'; end if;

  insert into orders (quote_id, company_id, invoice_number, total_kzt, vat_kzt)
  values (v_q.id, v_q.company_id, next_doc_number('invoice'), v_q.total_kzt, v_q.vat_kzt)
  returning id into v_order;
  return v_order;
end $$;

revoke all on function create_quote(jsonb, text, text, text) from public, anon;
revoke all on function issue_invoice(uuid) from public, anon;
grant execute on function create_quote(jsonb, text, text, text) to authenticated;
grant execute on function issue_invoice(uuid) to authenticated;
