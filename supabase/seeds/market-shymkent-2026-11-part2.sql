-- Расширение стартового каталога (ноябрь 2026), вторая партия. НЕ миграция. Правила те же, что в
-- market-shymkent-2026-11.sql: средние открытые цены с НДС, округление до 10 ₸, цены закреплены, «под заказ, 3 дня».
-- Источники: Satu (в т.ч. shyimkent.satu.kz), Akvilon, BIST, Kaspi, Flagma, Пульс цен. Где нет цен по Шымкенту —
-- среднее по Казахстану (помечено). Повторный запуск безопасен: позиции обновляются по артикулу.
begin;
create temp table seed (
  sku text, cat text, grp text, name text, spec text, unit text, price numeric,
  tier_qty numeric, tier_price numeric, attrs jsonb
) on commit drop;

insert into seed values
-- PP-R 20 PN20: Jakko 283 / Valtec 650 / Valtec 735 → 560 (Казахстан)
('MKT-PPR-20-PN20','ppr-pipes','Труба PP-R PN20','Труба полипропиленовая PP-R 20 мм PN20','Диаметр 20 мм, PN20, без армирования','м',560,null,null,'{"pipe_diameter":"20","pn":"pn20","reinforcement":"none"}'),
-- PP-R 32 PN20: Casa Calda 500 / Jakko 815 / Контур 1 412 / РТП 1 570 → 1 070 (Казахстан; Fusitek 433 — сомнительная карточка, исключён)
('MKT-PPR-32-PN20','ppr-pipes','Труба PP-R PN20','Труба полипропиленовая PP-R 32 мм PN20','Диаметр 32 мм, PN20, без армирования','м',1070,null,null,'{"pipe_diameter":"32","pn":"pn20","reinforcement":"none"}'),
-- ПНД 32 для воды: 175 / 185 → 180 (Казахстан, PN не указан)
('MKT-PE-32','pe-pipes','Труба ПНД для воды','Труба ПНД 32 мм для холодной воды','Диаметр 32 мм, полиэтилен','м',180,null,null,'{"pipe_diameter":"32"}'),
-- Кабель ВВГнг 3×1,5: 390 / 420 → 400 (754 — бухта 100 м премиум-марки, выброс)
('MKT-VVGNG-3X1.5','electro',null,'Кабель ВВГнг(А) 3×1,5','3 жилы × 1,5 мм², 0,66 кВ','м',400,null,null,'{}'),
-- Профиль ПП 60×27 3 м: Шымкент Knauf 2 650; Казахстан 1 750 / 1 350 / 1 176 / 2 290 → 1 840 (590 — ошибка карточки)
('MKT-PROF-PP6027-3','dry-mixes',null,'Профиль потолочный ПП 60×27, 3 м','Для каркаса ГКЛ, оцинкованный, длина 3 м','шт',1840,null,null,'{}'),
-- Саморез кровельный 4,8×35 окрашенный: 15,8 (Шымкент, 300 шт за 4 750) / 15,2 / 13,8 / 15 ₸/шт → 15 ₸ → упаковка 250 шт 3 750
('MKT-SCR-4.8X35-3005','roof-fasteners','Саморез кровельный 4,8×35','Саморез кровельный 4,8×35 RAL 3005, уп. 250 шт','С буром и шайбой EPDM','уп.',3750,null,null,'{"ral":"RAL3005"}'),
('MKT-SCR-4.8X35-6005','roof-fasteners','Саморез кровельный 4,8×35','Саморез кровельный 4,8×35 RAL 6005, уп. 250 шт','С буром и шайбой EPDM','уп.',3750,null,null,'{"ral":"RAL6005"}'),
('MKT-SCR-4.8X35-8017','roof-fasteners','Саморез кровельный 4,8×35','Саморез кровельный 4,8×35 RAL 8017, уп. 250 шт','С буром и шайбой EPDM','уп.',3750,null,null,'{"ral":"RAL8017"}'),
-- Пенопласт ПСБ-С 25: Шымкент 23 200 / 22 000 / 29 000 ₸/м³ → 24 730
('MKT-PSB-S25-50','insulation',null,'Пенопласт ПСБ-С 25, 50 мм','Пенополистирол, плотность М25, плита 50 мм','м³',24730,null,null,'{}'),
-- Ceresit CM 11, 25 кг: 3 499 / 3 320 / 4 035 / 3 100 / 4 845 → 3 760 (Казахстан; CM 11 Plus не учитывался)
('MKT-CERESIT-CM11-25','dry-mixes',null,'Клей для плитки Ceresit CM 11, 25 кг','Цементный, для внутренних и наружных работ, мешок 25 кг','мешок',3760,null,null,'{}'),
-- Изоспан AM 70 м²: Шымкент 33 600; Казахстан 23 800 / 24 850 → 27 420
('MKT-IZOSPAN-AM-70','roof-membranes',null,'Мембрана гидро-ветрозащитная Изоспан AM, 70 м²','Паропроницаемая, рулон 70 м²','рулон',27420,null,null,'{}');

insert into product_groups (category_id, slug, name)
select distinct c.id, 'mkt-' || substr(md5(s.cat || s.grp), 1, 10), s.grp
from seed s join categories c on c.slug = s.cat
where s.grp is not null
on conflict (slug) do nothing;

insert into products (sku, category_id, group_id, name, spec, unit, price_kzt, price_locked, in_stock, lead_time_days, is_active, import_batch)
select s.sku, c.id, g.id, s.name, s.spec, s.unit, s.price, true, false, 3, true, 'Рынок Шымкент, ноябрь 2026 (ориентир)'
from seed s
join categories c on c.slug = s.cat
left join product_groups g on g.slug = 'mkt-' || substr(md5(s.cat || coalesce(s.grp, '')), 1, 10) and s.grp is not null
on conflict (sku) do update set price_kzt = excluded.price_kzt, name = excluded.name, spec = excluded.spec, updated_at = now(), price_updated_at = now();

delete from product_attributes where product_id in (select p.id from products p join seed s on s.sku = p.sku);
insert into product_attributes (product_id, attribute_id, value)
select p.id, a.id, kv.value
from seed s join products p on p.sku = s.sku
cross join lateral jsonb_each_text(s.attrs) kv
join attributes a on a.code = kv.key;

delete from price_tiers where product_id in (select p.id from products p join seed s on s.sku = p.sku);
insert into price_tiers (product_id, min_qty, price_kzt)
select p.id, s.tier_qty, s.tier_price from seed s join products p on p.sku = s.sku where s.tier_qty is not null;
commit;
