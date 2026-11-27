-- Расчёт доставки по городу: вес заказа → класс машины → стоимость.
-- Тарифы — строки delivery_tariffs с method = 'city' и потолком веса max_kg; правит персонал.
-- Корзина показывает оценку (delivery_estimate, доступна гостям), create_quote подставляет её в КП.
-- Менеджер по-прежнему может поправить доставку в КП (set_quote_delivery).

alter table delivery_tariffs add column if not exists name text;
alter table delivery_tariffs add column if not exists max_kg numeric(10,1);

insert into delivery_tariffs (method, city, name, max_kg, base_kzt, per_kg_kzt, days_min, days_max)
select 'city', 'Шымкент', t.name, t.max_kg, t.base, 0, 1, 1
from (values
  ('Газель до 1,5 т',      1500, 10000),
  ('Грузовик до 5 т',      5000, 18000),
  ('КамАЗ до 10 т',       10000, 28000),
  ('Фура до 20 т',        20000, 45000)
) as t(name, max_kg, base)
where not exists (select 1 from delivery_tariffs where method = 'city' and max_kg is not null);

-- Вес и машина по строкам корзины [{"product_id": "...", "qty": 12}, ...].
-- unknown_lines — строки без веса у товара: тогда стоимость не считаем, решает менеджер.
create or replace function delivery_estimate(p_items jsonb)
returns table (weight_kg numeric, unknown_lines int, vehicle text, cost_kzt numeric, max_kg numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_weight  numeric := 0;
  v_unknown int := 0;
  v_item    jsonb;
  v_qty     numeric;
  v_w       numeric;
  v_found   boolean;
  v_max     numeric;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then raise exception 'bad_items'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := nullif(v_item->>'qty', '')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 1000000 then raise exception 'bad_qty'; end if;
    select p.weight_kg, true into v_w, v_found
      from products p where p.id = (v_item->>'product_id')::uuid and p.is_active;
    if not coalesce(v_found, false) then continue; end if;
    if v_w is null or v_w <= 0 then v_unknown := v_unknown + 1;
    else v_weight := v_weight + v_qty * v_w;
    end if;
    v_found := false;
  end loop;

  select max(t.max_kg) into v_max from delivery_tariffs t where t.method = 'city' and t.max_kg is not null;

  return query
  select round(v_weight, 1), v_unknown, t.name,
         case when v_unknown = 0 then round(t.base_kzt + t.per_kg_kzt * v_weight) end,
         v_max
  from (select 1) one
  left join lateral (
    select d.name, d.base_kzt, d.per_kg_kzt from delivery_tariffs d
    where d.method = 'city' and d.max_kg is not null and d.max_kg >= v_weight
    order by d.max_kg limit 1
  ) t on true;
end $$;
revoke all on function delivery_estimate(jsonb) from public;
grant execute on function delivery_estimate(jsonb) to anon, authenticated;

-- КП из корзины: то же, что в 0004, плюс доставка по городу из тарифа, если вес известен целиком.
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
  v_delivery numeric := 0;
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

  -- по городу — из тарифа, если у всех товаров есть вес и машина подходит; иначе (и межгород) — менеджер
  if p_delivery_method = 'city' then
    select coalesce(e.cost_kzt, 0) into v_delivery from delivery_estimate(p_items) e;
  end if;

  update quotes
     set delivery_kzt = v_delivery,
         goods_kzt = v_goods,
         total_kzt = v_goods + v_delivery,
         vat_kzt   = round((v_goods + v_delivery) * 16 / 116)
   where id = v_quote;

  return v_quote;
end $$;
