-- Гости видят товары раздела без цен: название, характеристики, единица, наличие.
-- Таблица products по-прежнему закрыта для anon (RLS), цены и закупка не отдаются.
create or replace function catalog_products_public(p_category_ids int[])
returns table (id uuid, name text, spec text, unit text, in_stock boolean, lead_time_days int, group_id uuid, attrs jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.spec, p.unit, p.in_stock, p.lead_time_days, p.group_id,
         coalesce((select jsonb_object_agg(a.code, pa.value)
                     from product_attributes pa join attributes a on a.id = pa.attribute_id
                    where pa.product_id = p.id), '{}'::jsonb)
  from products p
  where p.is_active and p.category_id = any (p_category_ids[1:50])
  order by p.name
  limit 1000
$$;
revoke all on function catalog_products_public(int[]) from public;
grant execute on function catalog_products_public(int[]) to anon, authenticated;
