-- Админка: печати и подписи продавцов, правка КП менеджером, статусы заказов, импорт прайсов.

-- ── Печати и подписи: закрытое хранилище ──
-- Файлы читают только вошедшие пользователи (сервер встраивает картинку в PDF их сессией),
-- загружает и меняет только персонал. В sellers.stamp_url / signature_url хранится путь в хранилище.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy branding_read on storage.objects for select to authenticated
  using (bucket_id = 'branding');

create policy branding_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and is_staff());
create policy branding_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and is_staff());
create policy branding_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and is_staff());

-- менеджер скачивает файлы спецификаций (чтение для персонала уже есть в 0002)

-- ── Правка КП менеджером: доставка и продавец, пока счёт не выставлен ──
create or replace function staff_update_quote(
  p_quote_id uuid,
  p_delivery_kzt numeric,
  p_seller_code text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_seller smallint;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if p_delivery_kzt is null or p_delivery_kzt < 0 or p_delivery_kzt > 100000000 then raise exception 'bad_delivery_amount'; end if;
  if exists (select 1 from orders where quote_id = p_quote_id) then raise exception 'invoice_exists'; end if;

  select id into v_seller from sellers where code = p_seller_code;
  if v_seller is null then raise exception 'bad_seller'; end if;

  update quotes
     set delivery_kzt = round(p_delivery_kzt, 2),
         seller_id    = v_seller,
         total_kzt    = goods_kzt + round(p_delivery_kzt, 2),
         vat_kzt      = round((goods_kzt + round(p_delivery_kzt, 2)) * 16 / 116)
   where id = p_quote_id;
  if not found then raise exception 'quote_not_found'; end if;
end $$;
revoke all on function staff_update_quote(uuid, numeric, text) from public, anon;
grant execute on function staff_update_quote(uuid, numeric, text) to authenticated;

-- ── Статус заказа с отметкой времени ──
create or replace function staff_set_order_status(p_order_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if p_status not in ('awaiting_payment','paid','shipped','delivered','cancelled') then raise exception 'bad_status'; end if;
  update orders
     set status       = p_status,
         paid_at      = case when p_status = 'paid'      and paid_at      is null then now() else paid_at end,
         shipped_at   = case when p_status = 'shipped'   and shipped_at   is null then now() else shipped_at end,
         delivered_at = case when p_status = 'delivered' and delivered_at is null then now() else delivered_at end
   where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;
end $$;
revoke all on function staff_set_order_status(uuid, text) from public, anon;
grant execute on function staff_set_order_status(uuid, text) to authenticated;

-- ── Импорт прайсов: откуда пришла позиция ──
alter table products add column if not exists import_batch text;   -- имя файла и дата загрузки
alter table products add column if not exists updated_at timestamptz not null default now();
-- цена задана вручную (колонка «Цена продажи» в прайсе) — пересчёт по курсу её не трогает
alter table products add column if not exists price_locked boolean not null default false;

-- ── Пересчёт цен по последнему курсу и наценкам ──
-- Та же формула, что в src/lib/pricing.ts: (закупка × курс + логистика) × (1 + наценка) × 1,16, вверх до тенге.
create or replace function staff_recalc_prices() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not is_staff() then raise exception 'forbidden'; end if;

  with rates as (
    select distinct on (currency) currency, kzt_per_unit
    from exchange_rates order by currency, rate_date desc
  ), calc as (
    select p.id,
           ceil(round(((p.purchase_price * case when p.purchase_currency = 'KZT' then 1 else r.kzt_per_unit end)
                       + p.logistics_kzt)
                      * (1 + coalesce(p.markup_pct, c.markup_pct, pc.markup_pct, 20) / 100)
                      * 1.16, 2)) as price
    from products p
    join categories c on c.id = p.category_id
    left join categories pc on pc.id = c.parent_id
    left join rates r on r.currency = p.purchase_currency
    where p.purchase_price is not null
      and not p.price_locked
      and (p.purchase_currency = 'KZT' or r.kzt_per_unit is not null)
  )
  update products p
     set price_kzt = calc.price, price_updated_at = now(), updated_at = now()
    from calc
   where p.id = calc.id and p.price_kzt is distinct from calc.price;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function staff_recalc_prices() from public, anon;
grant execute on function staff_recalc_prices() to authenticated;
