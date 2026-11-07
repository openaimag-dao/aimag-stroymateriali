-- Разбор спецификаций ИИ: позиции заявки → товары каталога → черновик КП для менеджера.
-- ИИ только предлагает: КП создаёт менеджер после проверки, цены считает база (как в create_quote).

-- ── Результат разбора ──────────────────────────────────────────
alter table specs add column if not exists ai_status text not null default 'pending'
  check (ai_status in ('pending', 'done', 'failed', 'skipped'));
alter table specs add column if not exists ai_error   text;          -- почему не разобрали (для менеджера)
alter table specs add column if not exists ai_model   text;
alter table specs add column if not exists ai_summary text;          -- объект, сроки, пожелания из заявки
alter table specs add column if not exists parsed_at  timestamptz;

alter table spec_items add column if not exists name       text;      -- позиция, приведённая к виду каталога
alter table spec_items add column if not exists note       text;      -- комментарий ИИ: чем отличается, что уточнить
alter table spec_items add column if not exists candidates uuid[] not null default '{}';  -- варианты для выбора менеджером

-- ── Кандидаты из каталога по текстовым запросам ────────────────
-- Для каждой строки p_queries — до p_limit активных товаров по полнотекстовому поиску (любое из слов),
-- лучшие сверху. Работает с правами вызывающего (RLS: товары видят вошедшие).
create or replace function spec_candidates(p_queries text[], p_limit int default 6)
returns table (q int, product_id uuid, sku text, name text, spec text, unit text,
               price_kzt numeric, in_stock boolean, attrs text, rank real)
language sql stable security invoker set search_path = public as $$
  with qs as (
    select i::int as q,
           nullif(replace(plainto_tsquery('russian', left(t, 300))::text, ' & ', ' | '), '')::tsquery as tq
    from unnest(p_queries[1:300]) with ordinality as u(t, i)
  )
  select qs.q, p.id, p.sku, p.name, p.spec, p.unit, p.price_kzt, p.in_stock,
         (select string_agg(a.name || ': ' || coalesce(o.label, pa.value), ', ' order by a.sort)
            from product_attributes pa
            join attributes a on a.id = pa.attribute_id
            left join attribute_options o on o.attribute_id = pa.attribute_id and o.value = pa.value
           where pa.product_id = p.id) as attrs,
         r.rank
  from qs
  cross join lateral (
    select pr.id, ts_rank(pr.search, qs.tq) as rank
    from products pr
    where qs.tq is not null and pr.is_active and pr.search @@ qs.tq
    order by ts_rank(pr.search, qs.tq) desc, pr.in_stock desc
    limit least(greatest(p_limit, 1), 12)
  ) r
  join products p on p.id = r.id
  order by qs.q, r.rank desc;
$$;
revoke all on function spec_candidates(text[], int) from public, anon;
grant execute on function spec_candidates(text[], int) to authenticated;

-- ── Сохранение разбора ─────────────────────────────────────────
-- p_items: [{"line_no":1,"source_text":"...","name":"...","qty":10,"unit":"м","product_id":"...",
--            "match_status":"found","confidence":0.9,"note":"...","candidates":["..."]}]
-- Покупатель (сервер сайта его сессией) записывает разбор своей заявки один раз — пока она в статусе pending;
-- персонал — в любой момент (повторный разбор). Неизвестные товары отбрасываются.
create or replace function save_spec_parse(
  p_spec_id uuid,
  p_items   jsonb,
  p_status  text,
  p_model   text default null,
  p_error   text default null,
  p_summary text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_spec specs%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_status not in ('done', 'failed', 'skipped') then raise exception 'bad_status'; end if;

  select * into v_spec from specs where id = p_spec_id for update;
  if not found then raise exception 'spec_not_found'; end if;
  if not (is_staff() or (v_spec.company_id in (select my_company_ids()) and v_spec.ai_status = 'pending')) then
    raise exception 'forbidden';
  end if;

  if p_items is not null and jsonb_typeof(p_items) <> 'array' then raise exception 'bad_items'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) > 300 then raise exception 'too_many_lines'; end if;

  delete from spec_items where spec_id = p_spec_id;

  insert into spec_items (spec_id, line_no, source_text, name, qty, unit, product_id, match_status, confidence, note, candidates)
  select p_spec_id,
         row_number() over (order by e.ord),
         left(coalesce(nullif(trim(x.source_text), ''), x.name, '—'), 500),
         left(x.name, 300),
         case when x.qty > 0 and x.qty <= 1000000 then round(x.qty, 3) end,
         left(x.unit, 20),
         pr.id,
         case when pr.id is not null and x.match_status = 'found' then 'found'
              when x.match_status in ('to_order', 'not_supplied') then x.match_status
              else 'pending' end,
         case when x.confidence between 0 and 1 then round(x.confidence, 3) end,
         left(x.note, 500),
         coalesce((select array_agg(c.id) from products c
                    where c.is_active and c.id::text in (select jsonb_array_elements_text(coalesce(x.candidates, '[]')))), '{}')
  from jsonb_array_elements(coalesce(p_items, '[]')) with ordinality as e(j, ord)
  cross join lateral jsonb_to_record(e.j)
       as x(source_text text, name text, qty numeric, unit text, product_id text, match_status text,
            confidence numeric, note text, candidates jsonb)
  left join products pr on pr.is_active and pr.id::text = x.product_id;

  update specs
     set ai_status  = p_status,
         ai_model   = left(p_model, 60),
         ai_error   = left(p_error, 500),
         ai_summary = left(p_summary, 1000),
         parsed_at  = now(),
         status     = case when status = 'parsing' then 'review' else status end
   where id = p_spec_id;
end $$;
revoke all on function save_spec_parse(uuid, jsonb, text, text, text, text) from public, anon;
grant execute on function save_spec_parse(uuid, jsonb, text, text, text, text) to authenticated;

-- ── КП для компании: общая часть create_quote ──────────────────
-- Вызывается только из функций ниже (у вызывающих нет права execute).
create or replace function quote_for_company(
  p_company uuid,
  p_items jsonb,
  p_delivery_method text,
  p_delivery_city text,
  p_delivery_address text,
  p_source text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
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
  if p_delivery_method not in ('pickup','city','intercity') then raise exception 'bad_delivery'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_cart'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'too_many_lines'; end if;

  select personal_discount_pct into v_discount from companies where id = p_company;
  if not found then raise exception 'no_company'; end if;

  select id into v_seller from sellers where code = 'aimag';

  insert into quotes (number, company_id, seller_id, delivery_method, delivery_city, delivery_address, source, created_by)
  values (next_doc_number('quote'), p_company, v_seller, p_delivery_method,
          left(p_delivery_city, 120), left(p_delivery_address, 300), p_source, auth.uid())
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
revoke all on function quote_for_company(uuid, jsonb, text, text, text, text) from public, anon, authenticated;

-- create_quote — прежний контракт, расчёт теперь в quote_for_company
create or replace function create_quote(
  p_items jsonb,
  p_delivery_method text default 'pickup',
  p_delivery_city text default null,
  p_delivery_address text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select m.company_id into v_company
  from company_members m
  where m.user_id = auth.uid()
  order by (m.role = 'owner') desc
  limit 1;
  if v_company is null then raise exception 'no_company'; end if;

  return quote_for_company(v_company, p_items, p_delivery_method, p_delivery_city, p_delivery_address, 'cart');
end $$;

-- ── КП из проверенной спецификации ─────────────────────────────
-- Берёт позиции со статусом «найдено», товаром и количеством. Остальные менеджер дописывает вручную или
-- сообщает покупателю, что их нет.
create or replace function staff_quote_from_spec(p_spec_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_spec  specs%rowtype;
  v_items jsonb;
  v_quote uuid;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select * into v_spec from specs where id = p_spec_id for update;
  if not found then raise exception 'spec_not_found'; end if;

  select jsonb_agg(jsonb_build_object('product_id', product_id, 'qty', qty) order by line_no) into v_items
  from spec_items
  where spec_id = p_spec_id and match_status = 'found' and product_id is not null and qty > 0;
  if v_items is null then raise exception 'no_matched_items'; end if;

  v_quote := quote_for_company(v_spec.company_id, v_items, 'pickup', null, null, 'spec');
  update specs set quote_id = v_quote, status = 'quoted' where id = p_spec_id;
  return v_quote;
end $$;
revoke all on function staff_quote_from_spec(uuid) from public, anon;
grant execute on function staff_quote_from_spec(uuid) to authenticated;
