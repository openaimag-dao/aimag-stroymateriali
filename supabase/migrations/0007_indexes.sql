-- Индексы по советам Supabase Performance Advisor: связи, по которым идут запросы и правила доступа.
create index if not exists company_members_user_idx on company_members (user_id);   -- my_company_ids() в каждом правиле
create index if not exists quotes_company_idx       on quotes (company_id, created_at desc);
create index if not exists orders_company_idx       on orders (company_id);
create index if not exists specs_company_idx        on specs (company_id, created_at desc);
create index if not exists categories_parent_idx    on categories (parent_id);
create index if not exists quote_items_product_idx  on quote_items (product_id);

-- auth.uid() один раз на запрос, а не на каждую строку
drop policy if exists staff_self on staff;
create policy staff_self on staff for select to authenticated
  using (user_id = (select auth.uid()) or is_staff());
