-- Стартовый каталог, третья партия (ноябрь 2026): пустые подразделы. НЕ миграция.
-- Правила как в market-shymkent-2026-11.sql: средние открытые цены с НДС, округление до 10 ₸, цены закреплены,
-- «под заказ, 3 дня». Где у конкретной модели одна цена по Шымкенту — взята она (помечено).
begin;
create temp table seed (
  sku text, cat text, grp text, name text, spec text, unit text, price numeric,
  tier_qty numeric, tier_price numeric, attrs jsonb
) on commit drop;

insert into seed values
-- Желоб 125 мм, 3 м: Шымкент 3 236 (полимер) / ТехноНИКОЛЬ 3 702 / Лемана 3 850 → 3 600
('MKT-GUT-125-3M-8017','gutters','Желоб водосточный 125 мм, 3 м','Желоб водосточный 125 мм, 3 м, RAL 8017','Ширина 125 мм, длина 3 м','шт',3600,null,null,'{"ral":"RAL8017"}'),
('MKT-GUT-125-3M-9003','gutters','Желоб водосточный 125 мм, 3 м','Желоб водосточный 125 мм, 3 м, RAL 9003','Ширина 125 мм, длина 3 м','шт',3600,null,null,'{"ral":"RAL9003"}'),
-- Конёк окрашенный: Шымкент 2 393 ₸/м / 2 425 / 2 680 → 2 500 ₸/м
('MKT-RIDGE-PE-3005','roof-extras','Конёк кровельный полиэстер','Конёк кровельный полиэстер RAL 3005','Сталь с полимерным покрытием','м',2500,null,null,'{"coating":"pe","ral":"RAL3005"}'),
('MKT-RIDGE-PE-6005','roof-extras','Конёк кровельный полиэстер','Конёк кровельный полиэстер RAL 6005','Сталь с полимерным покрытием','м',2500,null,null,'{"coating":"pe","ral":"RAL6005"}'),
('MKT-RIDGE-PE-8017','roof-extras','Конёк кровельный полиэстер','Конёк кровельный полиэстер RAL 8017','Сталь с полимерным покрытием','м',2500,null,null,'{"coating":"pe","ral":"RAL8017"}'),
-- Канализационная труба 110, 2 м: Deniz 2 811 / Армоснаб 3 990 / 1 245 ₸/п.м × 2 = 2 490 → 3 100
('MKT-SEW-110-2M','sewer','Труба канализационная ПВХ','Труба канализационная ПВХ 110 мм, 2 м','Диаметр 110 мм, длина 2 м','шт',3100,null,null,'{"pipe_diameter":"110"}'),
-- Кран шаровой 1/2 латунь: 1 420 / 1 850 / 3 095 → 2 120 (промышленный 11Б27п1 за 6 462 — выброс)
('MKT-VALVE-BALL-1/2','valves','Кран шаровой латунный','Кран шаровой латунный 1/2″','Латунь, резьба 1/2″','шт',2120,null,null,'{"thread":"1/2"}'),
-- PP-R фитинги 25: муфта Deniz 50 / RTP 87 / 60 → 70; угольник 90° 57 / 98 / 147 → 100
('MKT-PPRF-COUPLING-25','ppr-fittings','Фитинги PP-R','Муфта PP-R 25 мм','Соединительная, под пайку','шт',70,null,null,'{"fitting_type":"coupling","pipe_diameter":"25"}'),
('MKT-PPRF-ELBOW90-25','ppr-fittings','Фитинги PP-R','Угольник PP-R 90° 25 мм','Под пайку','шт',100,null,null,'{"fitting_type":"elbow90","pipe_diameter":"25"}'),
-- Сайдинг виниловый корабельная доска 3 м: 1 992 / 2 590 / 2 083 / 2 840 → 2 380 ₸/панель
('MKT-SIDING-PVC-SHIP-3M','siding','Сайдинг виниловый «Корабельная доска»','Сайдинг виниловый «Корабельная доска», 3 м','Панель ПВХ, длина 3 м','панель',2380,null,null,'{"siding_material":"pvc","siding_profile":"ship"}'),
-- Фасадные панели Docke — цены моделей в Шымкенте
('MKT-PANEL-DOCKE-FELS','facade-panels','Фасадные панели Docke','Фасадная панель Docke Fels, Стальной','Под камень, 1052×425 мм','панель',3570,null,null,'{"panel_material":"pvc-stone"}'),
('MKT-PANEL-DOCKE-KLINKER','facade-panels','Фасадные панели Docke','Фасадная панель Docke Klinker, Каракумы','Под кирпич, 998×406 мм','панель',3320,null,null,'{"panel_material":"pvc-stone"}'),
-- Изоспан A 70 м² — цена в Шымкенте
('MKT-IZOSPAN-A-70','facade-membranes',null,'Мембрана ветрозащитная Изоспан A, 70 м²','Для стен и вентфасада, рулон 70 м²','рулон',21000,null,null,'{}'),
-- Муфта компрессионная ПНД 32 соединительная: 558 / 390 → 470
('MKT-PEF-COUPLING-32','pe-fittings','Компрессионные фитинги ПНД','Муфта компрессионная ПНД 32 мм','Соединительная, для водопровода','шт',470,null,null,'{"fitting_type":"coupling","pipe_diameter":"32"}'),
-- J-профиль ПВХ 3 м: Шымкент 1 636 (Альта-Профиль) / 700 → 1 170
('MKT-SIDING-J-PVC-3M','siding-extras',null,'J-профиль для винилового сайдинга, 3 м','ПВХ, длина 3 м','шт',1170,null,null,'{"siding_material":"pvc"}'),
-- Кронштейн фасадный оцинкованный 120×50×50 — цена в Шымкенте
('MKT-VF-BRACKET-120','vent-facade',null,'Кронштейн фасадный оцинкованный 120×50×50 мм','Для подсистемы вентфасада','шт',120,null,null,'{}');

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
commit;
