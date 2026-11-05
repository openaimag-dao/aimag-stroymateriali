-- AIMAG Stroymateriali — начальная схема базы (Supabase Postgres)
-- Принципы:
--   * одна цена товара на сайте, в КП и в счёте: строки КП/счёта хранят снимок цены;
--   * все цены в тенге с НДС 16%; закупка может быть в RUB/CNY/KZT;
--   * покупатель видит только данные своей компании (RLS).

create extension if not exists pgcrypto;

-- ── Справочники ────────────────────────────────────────────────

create table sellers (                       -- от кого выставляем документы
  id          smallint primary key,
  code        text unique not null,          -- 'aimag' | 'bereke'
  name        text not null,                 -- 'ИП AIMAG', 'ЖК Bereke'
  bin         text not null,
  director    text not null,
  address     text,
  bank_name   text,
  bik         text,
  iban        text,
  phone       text not null default '+7 705 615-17-17',
  vat_payer   boolean not null default true,
  stamp_url   text,                          -- печать и факсимиле в Storage
  signature_url text
);

create table categories (
  id          serial primary key,
  parent_id   int references categories(id),
  slug        text unique not null,
  name        text not null,
  markup_pct  numeric(5,2) not null default 20,   -- наценка категории, 12–40%
  sort        int not null default 0
);

create table suppliers (
  id          serial primary key,
  name        text not null,
  country     text not null check (country in ('KZ','RU','CN','OTHER')),
  contact     text,
  notes       text
);

create table exchange_rates (                -- курс НБ РК, обновляется ежедневно
  currency    text not null check (currency in ('RUB','CNY','USD','EUR')),
  rate_date   date not null,
  kzt_per_unit numeric(12,4) not null,
  primary key (currency, rate_date)
);

-- ── Товары и цены ──────────────────────────────────────────────

create table products (
  id              uuid primary key default gen_random_uuid(),
  sku             text unique,
  category_id     int not null references categories(id),
  supplier_id     int references suppliers(id),
  name            text not null,
  spec            text,                      -- ГОСТ/ТУ, характеристики
  unit            text not null,             -- м, шт, м², т, кг
  country         text,
  purchase_price  numeric(14,2),             -- закупка без НДС
  purchase_currency text not null default 'KZT',
  logistics_kzt   numeric(14,2) not null default 0,  -- доставка до склада на единицу
  markup_pct      numeric(5,2),              -- если null — берём наценку категории
  price_kzt       numeric(14,2) not null,    -- ЕДИНАЯ цена с НДС для сайта, КП и счетов
  price_updated_at timestamptz not null default now(),
  in_stock        boolean not null default false,
  lead_time_days  int,                       -- для товара под заказ
  weight_kg       numeric(10,3),
  is_active       boolean not null default true,
  search          tsvector generated always as
                  (to_tsvector('russian', coalesce(name,'') || ' ' || coalesce(spec,''))) stored
);
create index products_search_idx on products using gin (search);
create index products_category_idx on products (category_id) where is_active;

create table price_tiers (                   -- оптовые уровни: от N единиц — цена
  product_id  uuid not null references products(id) on delete cascade,
  min_qty     numeric(14,3) not null,
  price_kzt   numeric(14,2) not null,
  primary key (product_id, min_qty)
);

-- ── Компании-покупатели ────────────────────────────────────────

create table companies (
  id          uuid primary key default gen_random_uuid(),
  bin         text unique not null check (bin ~ '^\d{12}$'),
  name        text not null,
  legal_form  text,                          -- ТОО, ИП, АО
  director    text,
  address     text,
  oked        text,
  vat_payer   boolean,
  is_active   boolean,                       -- статус из реестра на дату проверки
  checked_at  timestamptz,
  bank_name   text,
  bik         text,
  iban        text,
  invoice_email text,
  personal_discount_pct numeric(5,2) not null default 0,
  created_at  timestamptz not null default now()
);

create table company_members (               -- сотрудники компании ↔ auth.users
  company_id  uuid not null references companies(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  role        text not null default 'buyer' check (role in ('owner','buyer','accountant')),
  primary key (company_id, user_id)
);

create table staff (                         -- менеджеры и админы магазина
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin','manager'))
);

-- ── Корзина, КП, счета, заказы ─────────────────────────────────

create table carts (
  company_id  uuid primary key references companies(id) on delete cascade,
  updated_at  timestamptz not null default now()
);

create table cart_items (
  company_id  uuid not null references carts(company_id) on delete cascade,
  product_id  uuid not null references products(id),
  qty         numeric(14,3) not null check (qty > 0),
  primary key (company_id, product_id)
);

create table delivery_tariffs (
  id          serial primary key,
  method      text not null check (method in ('pickup','city','intercity')),
  city        text,
  base_kzt    numeric(14,2) not null default 0,
  per_kg_kzt  numeric(14,4) not null default 0,
  days_min    int,
  days_max    int
);

create sequence doc_number_seq;

create table quotes (                        -- КП
  id          uuid primary key default gen_random_uuid(),
  number      text unique not null default to_char(now(),'YYYY') || '-' || lpad(nextval('doc_number_seq')::text, 4, '0'),
  company_id  uuid not null references companies(id),
  seller_id   smallint not null references sellers(id),
  valid_until date not null default (current_date + 7),   -- КП действует 7 дней
  delivery_method text,
  delivery_city   text,
  delivery_address text,
  delivery_kzt numeric(14,2) not null default 0,
  pdf_path    text,
  source      text not null default 'cart' check (source in ('cart','spec','manager','whatsapp')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create table quote_items (
  quote_id    uuid not null references quotes(id) on delete cascade,
  line_no     int not null,
  product_id  uuid references products(id),
  name        text not null,                 -- снимок названия
  unit        text not null,
  qty         numeric(14,3) not null,
  price_kzt   numeric(14,2) not null,        -- снимок цены с НДС
  primary key (quote_id, line_no)
);

create table orders (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid unique not null references quotes(id),
  company_id  uuid not null references companies(id),
  invoice_number text unique,
  invoice_pdf_path text,
  status      text not null default 'awaiting_payment'
              check (status in ('awaiting_payment','paid','shipped','delivered','cancelled')),
  total_kzt   numeric(14,2) not null,
  vat_kzt     numeric(14,2) not null,
  paid_at     timestamptz,
  shipped_at  timestamptz,
  delivered_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ── Спецификации (тендер-запросы) ──────────────────────────────

create table specs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id),
  file_path   text not null,                 -- Storage: specs/<company>/<file>
  file_name   text not null,
  status      text not null default 'parsing'
              check (status in ('parsing','review','quoted','rejected')),
  quote_id    uuid references quotes(id),
  created_at  timestamptz not null default now()
);

create table spec_items (
  spec_id     uuid not null references specs(id) on delete cascade,
  line_no     int not null,
  source_text text not null,                 -- строка из заявки как есть
  qty         numeric(14,3),
  unit        text,
  product_id  uuid references products(id),  -- совпадение, найденное ИИ
  match_status text not null default 'pending'
              check (match_status in ('pending','found','to_order','not_supplied')),
  confidence  numeric(4,3),
  confirmed_by uuid references auth.users(id),
  primary key (spec_id, line_no)
);

-- ── Права доступа (RLS) ────────────────────────────────────────

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff where user_id = auth.uid()) $$;

create or replace function my_company_ids() returns setof uuid
language sql stable security definer set search_path = public as
$$ select company_id from company_members where user_id = auth.uid() $$;

-- каталог читают все вошедшие, правит только персонал
do $$
declare t text;
begin
  foreach t in array array['categories','products','price_tiers','delivery_tariffs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t || '_read', t);
    execute format('create policy %I on %I for all to authenticated using (is_staff()) with check (is_staff())', t || '_staff', t);
  end loop;
end $$;

-- закупочные данные — только персонал
alter table suppliers enable row level security;
create policy suppliers_staff on suppliers for all to authenticated using (is_staff()) with check (is_staff());
alter table exchange_rates enable row level security;
create policy rates_staff on exchange_rates for all to authenticated using (is_staff()) with check (is_staff());
alter table sellers enable row level security;
create policy sellers_read on sellers for select to authenticated using (true);
create policy sellers_staff on sellers for all to authenticated using (is_staff()) with check (is_staff());
alter table staff enable row level security;
create policy staff_self on staff for select to authenticated using (user_id = auth.uid() or is_staff());

-- данные компании — её сотрудникам и персоналу
alter table companies enable row level security;
create policy companies_own on companies for select to authenticated
  using (id in (select my_company_ids()) or is_staff());
-- правит только персонал: иначе покупатель мог бы сам поставить себе personal_discount_pct
create policy companies_update on companies for update to authenticated
  using (is_staff()) with check (is_staff());

alter table company_members enable row level security;
create policy members_own on company_members for select to authenticated
  using (company_id in (select my_company_ids()) or is_staff());

do $$
declare t text;
begin
  foreach t in array array['carts','cart_items','quotes','orders','specs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (company_id in (select my_company_ids()) or is_staff())', t || '_read', t);
    execute format('create policy %I on %I for all to authenticated using (is_staff()) with check (is_staff())', t || '_staff', t);
  end loop;
end $$;

-- покупатель сам ведёт свою корзину и загружает спецификации
create policy cart_items_own on cart_items for all to authenticated
  using (company_id in (select my_company_ids())) with check (company_id in (select my_company_ids()));
create policy carts_own on carts for all to authenticated
  using (company_id in (select my_company_ids())) with check (company_id in (select my_company_ids()));
create policy specs_insert on specs for insert to authenticated
  with check (company_id in (select my_company_ids()));

alter table quote_items enable row level security;
create policy quote_items_read on quote_items for select to authenticated
  using (exists (select 1 from quotes q where q.id = quote_id
                 and (q.company_id in (select my_company_ids()) or is_staff())));
create policy quote_items_staff on quote_items for all to authenticated using (is_staff()) with check (is_staff());

alter table spec_items enable row level security;
create policy spec_items_read on spec_items for select to authenticated
  using (exists (select 1 from specs s where s.id = spec_id
                 and (s.company_id in (select my_company_ids()) or is_staff())));
create policy spec_items_staff on spec_items for all to authenticated using (is_staff()) with check (is_staff());

-- ── Начальные данные ───────────────────────────────────────────

insert into sellers (id, code, name, bin, director, address) values
  (1, 'aimag',  'ИП AIMAG',  '890922301639', 'Оразбаев Е. О.', 'г. Шымкент'),
  (2, 'bereke', 'ЖК Bereke', '050404601141', 'Сагимбек А. Е.', null);

insert into categories (slug, name, sort) values
  ('electro',    'Электротехника и кабель',    1),
  ('dry-mixes',  'Сухие смеси и гипсокартон',  2),
  ('insulation', 'Теплоизоляция',              3),
  ('metal',      'Металлопрокат',              4),
  ('pipes',      'Трубы и сантехника',         5),
  ('roofing',    'Кровля и фасад',             6);

insert into delivery_tariffs (method, city, base_kzt, days_min, days_max) values
  ('pickup', 'Шымкент', 0, 0, 0);

-- ── Регистрация компании покупателем ───────────────────────────
-- Пользователь после входа по email создаёт компанию по БИН и сразу
-- становится её владельцем.
create or replace function register_company(
  p_bin text, p_name text, p_legal_form text default null,
  p_director text default null, p_address text default null,
  p_full_name text default null, p_phone text default null,
  p_invoice_email text default null, p_bik text default null, p_iban text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_bin !~ '^\d{12}$' then raise exception 'invalid BIN'; end if;

  insert into companies (bin, name, legal_form, director, address, invoice_email, bik, iban)
  values (p_bin, p_name, p_legal_form, p_director, p_address, p_invoice_email, p_bik, p_iban)
  on conflict (bin) do nothing
  returning id into v_company;

  if v_company is null then
    -- БИН уже зарегистрирован: присоединиться сам нельзя, иначе чужие заказы
    -- увидит любой, кто знает БИН. Сотрудников добавляет владелец или менеджер.
    raise exception 'company_exists' using hint = 'Попросите владельца аккаунта компании добавить вас';
  else
    insert into company_members (company_id, user_id, full_name, phone, role)
    values (v_company, auth.uid(), p_full_name, p_phone, 'owner');
    insert into carts (company_id) values (v_company);
  end if;
  return v_company;
end $$;

revoke all on function register_company from public, anon;
grant execute on function register_company to authenticated;
