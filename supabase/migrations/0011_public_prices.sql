-- Цены видны без входа: цена продажи с НДС и оптовые уровни. Закупка, наценка, поставщик и логистика —
-- по-прежнему только персоналу (таблица products для anon закрыта, гости читают через эти функции).
-- Персональная скидка компании применяется только в КП (create_quote).
drop function if exists catalog_products_public(int[]);
create function catalog_products_public(p_category_ids int[])
returns table (id uuid, name text, spec text, unit text, price_kzt numeric, in_stock boolean, lead_time_days int,
               group_id uuid, attrs jsonb, tiers jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.spec, p.unit, p.price_kzt, p.in_stock, p.lead_time_days, p.group_id,
         coalesce((select jsonb_object_agg(a.code, pa.value)
                     from product_attributes pa join attributes a on a.id = pa.attribute_id
                    where pa.product_id = p.id), '{}'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('min_qty', t.min_qty, 'price_kzt', t.price_kzt) order by t.min_qty)
                     from price_tiers t where t.product_id = p.id), '[]'::jsonb)
  from products p
  where p.is_active and p.category_id = any (p_category_ids[1:50])
  order by p.name
  limit 1000
$$;
revoke all on function catalog_products_public(int[]) from public;
grant execute on function catalog_products_public(int[]) to anon, authenticated;

-- Поиск по каталогу для гостей (то же, что /catalog?q= для вошедших)
create or replace function catalog_search_public(p_q text)
returns table (id uuid, name text, spec text, unit text, price_kzt numeric, in_stock boolean, lead_time_days int, tiers jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.spec, p.unit, p.price_kzt, p.in_stock, p.lead_time_days,
         coalesce((select jsonb_agg(jsonb_build_object('min_qty', t.min_qty, 'price_kzt', t.price_kzt) order by t.min_qty)
                     from price_tiers t where t.product_id = p.id), '[]'::jsonb)
  from products p
  where p.is_active and length(trim(coalesce(p_q, ''))) between 1 and 200
    and p.search @@ websearch_to_tsquery('russian', p_q)
  order by p.in_stock desc, p.name
  limit 200
$$;
revoke all on function catalog_search_public(text) from public;
grant execute on function catalog_search_public(text) to anon, authenticated;
