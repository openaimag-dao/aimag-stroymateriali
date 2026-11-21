-- Закупочная цена, валюта закупки, логистика, наценка и поставщик не читаются через API ни гостями,
-- ни покупателями. Колонки цены продажи и описания товара остаются открытыми вошедшим (RLS по-прежнему
-- решает, какие строки видны). Персонал работает с закупкой через импорт и функции security definer.
revoke select on products from anon, authenticated;
grant select (id, sku, category_id, group_id, name, spec, unit, country, price_kzt, price_updated_at,
              in_stock, lead_time_days, weight_kg, is_active, search, import_batch, updated_at, price_locked)
  on products to authenticated;

-- Загрузка прайса персоналом: upsert по артикулу. Через API upsert требует чтения всех колонок
-- (ON CONFLICT ... EXCLUDED), поэтому он идёт через функцию с проверкой is_staff().
create or replace function staff_import_products(p_rows jsonb)
returns table (id uuid, sku text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then raise exception 'bad_rows'; end if;

  return query
  insert into products as p (sku, category_id, group_id, name, spec, unit, purchase_price, purchase_currency,
                             logistics_kzt, markup_pct, price_kzt, price_locked, price_updated_at, in_stock,
                             lead_time_days, is_active, import_batch, updated_at)
  select r.sku, r.category_id, r.group_id, r.name, r.spec, r.unit, r.purchase_price, coalesce(r.purchase_currency, 'KZT'),
         coalesce(r.logistics_kzt, 0), r.markup_pct, r.price_kzt, coalesce(r.price_locked, false), now(),
         coalesce(r.in_stock, false), r.lead_time_days, true, left(r.import_batch, 200), now()
  from jsonb_to_recordset(p_rows) as r(sku text, category_id int, group_id uuid, name text, spec text, unit text,
       purchase_price numeric, purchase_currency text, logistics_kzt numeric, markup_pct numeric, price_kzt numeric,
       price_locked boolean, in_stock boolean, lead_time_days int, import_batch text)
  on conflict on constraint products_sku_key do update set
    category_id = excluded.category_id, group_id = excluded.group_id, name = excluded.name, spec = excluded.spec,
    unit = excluded.unit, purchase_price = excluded.purchase_price, purchase_currency = excluded.purchase_currency,
    logistics_kzt = excluded.logistics_kzt, markup_pct = excluded.markup_pct, price_kzt = excluded.price_kzt,
    price_locked = excluded.price_locked, price_updated_at = excluded.price_updated_at, in_stock = excluded.in_stock,
    lead_time_days = excluded.lead_time_days, is_active = true, import_batch = excluded.import_batch, updated_at = now()
  returning p.id, p.sku;
end $$;
revoke all on function staff_import_products(jsonb) from public, anon;
grant execute on function staff_import_products(jsonb) to authenticated;

-- Страница товара для всех: товар, раздел, группа, характеристики с подписями, оптовые уровни. Без закупки.
create or replace function catalog_product_public(p_id uuid)
returns table (id uuid, name text, spec text, unit text, price_kzt numeric, in_stock boolean, lead_time_days int,
               category_slug text, category_name text, parent_slug text, parent_name text, group_name text,
               attrs jsonb, tiers jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.spec, p.unit, p.price_kzt, p.in_stock, p.lead_time_days,
         c.slug, c.name, pc.slug, pc.name, g.name,
         coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'value', coalesce(o.label, pa.value)) order by a.sort)
                     from product_attributes pa
                     join attributes a on a.id = pa.attribute_id
                     left join attribute_options o on o.attribute_id = pa.attribute_id and o.value = pa.value
                    where pa.product_id = p.id), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('min_qty', t.min_qty, 'price_kzt', t.price_kzt) order by t.min_qty)
                     from price_tiers t where t.product_id = p.id), '[]'::jsonb),
         p.updated_at
  from products p
  join categories c on c.id = p.category_id
  left join categories pc on pc.id = c.parent_id
  left join product_groups g on g.id = p.group_id
  where p.id = p_id and p.is_active
$$;
revoke all on function catalog_product_public(uuid) from public;
grant execute on function catalog_product_public(uuid) to anon, authenticated;

-- Для sitemap: активные товары
create or replace function catalog_product_ids()
returns table (id uuid, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.updated_at from products p where p.is_active order by p.updated_at desc limit 5000
$$;
revoke all on function catalog_product_ids() from public;
grant execute on function catalog_product_ids() to anon, authenticated;
