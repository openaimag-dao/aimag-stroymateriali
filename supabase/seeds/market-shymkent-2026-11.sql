-- Стартовое наполнение каталога по средним рыночным ценам Шымкента (ноябрь 2026). НЕ миграция.
-- Источники: Пульс цен (pulscen.kz), Satu, OLX, Flagma, сайты местных баз и магазинов — открытые предложения с НДС.
-- Цены закреплены (price_locked): это ориентир, его нужно заменить прайсами поставщиков через /admin/import
-- (совпадение по артикулу MKT-… обновит позицию). Наличие — «под заказ, 3 дня».
-- Повторный запуск безопасен: позиции обновляются по артикулу.
begin;
-- Рыночный ориентир Шымкента (ноябрь 2026): средние цены открытых предложений, с НДС, округление до 10 ₸.
create temp table seed (
  sku text, cat text, grp text, name text, spec text, unit text, price numeric,
  tier_qty numeric, tier_price numeric, attrs jsonb
) on commit drop;

insert into seed values
-- Металлочерепица Монтеррей 0,45 полиэстер: 2 516 / 2 770 / 2 800 → 2 700; опт от 1000 м² −10%
('MKT-MT-045-PE-3005','metal-tile','Металлочерепица Монтеррей 0,45 полиэстер','Металлочерепица Монтеррей 0,45 мм полиэстер RAL 3005','Профиль Монтеррей, толщина 0,45 мм','м²',2700,1000,2430,'{"tile_profile":"monterrey","thickness":"0.45","coating":"pe","ral":"RAL3005"}'),
('MKT-MT-045-PE-6005','metal-tile','Металлочерепица Монтеррей 0,45 полиэстер','Металлочерепица Монтеррей 0,45 мм полиэстер RAL 6005','Профиль Монтеррей, толщина 0,45 мм','м²',2700,1000,2430,'{"tile_profile":"monterrey","thickness":"0.45","coating":"pe","ral":"RAL6005"}'),
('MKT-MT-045-PE-8017','metal-tile','Металлочерепица Монтеррей 0,45 полиэстер','Металлочерепица Монтеррей 0,45 мм полиэстер RAL 8017','Профиль Монтеррей, толщина 0,45 мм','м²',2700,1000,2430,'{"tile_profile":"monterrey","thickness":"0.45","coating":"pe","ral":"RAL8017"}'),
-- Профнастил окрашенный 0,45–0,5: 2 438 / 2 942 / 2 000 / 3 250 → 2 660
('MKT-PN-C21-050-PE-3005','profnastil','Профнастил С21 0,5 полиэстер','Профнастил С21 0,5 мм полиэстер RAL 3005','Профиль С21, толщина 0,5 мм','м²',2660,null,null,'{"proflist_profile":"c21","thickness":"0.50","coating":"pe","ral":"RAL3005"}'),
('MKT-PN-C21-050-PE-6005','profnastil','Профнастил С21 0,5 полиэстер','Профнастил С21 0,5 мм полиэстер RAL 6005','Профиль С21, толщина 0,5 мм','м²',2660,null,null,'{"proflist_profile":"c21","thickness":"0.50","coating":"pe","ral":"RAL6005"}'),
('MKT-PN-C21-050-PE-8017','profnastil','Профнастил С21 0,5 полиэстер','Профнастил С21 0,5 мм полиэстер RAL 8017','Профиль С21, толщина 0,5 мм','м²',2660,null,null,'{"proflist_profile":"c21","thickness":"0.50","coating":"pe","ral":"RAL8017"}'),
-- Профнастил оцинкованный 0,4: 800 / 825 → 810
('MKT-PN-C8-040-ZN','profnastil','Профнастил С8 оцинкованный','Профнастил С8 0,4 мм оцинкованный','Профиль С8, толщина 0,4 мм','м²',810,null,null,'{"proflist_profile":"c8","thickness":"0.40","coating":"zinc"}'),
-- Труба PP-R 25 PN20: 930 / 914 / 745 → 860
('MKT-PPR-25-PN20','ppr-pipes','Труба PP-R PN20','Труба полипропиленовая PP-R 25 мм PN20','Диаметр 25 мм, PN20, без армирования','м',860,null,null,'{"pipe_diameter":"25","pn":"pn20","reinforcement":"none"}'),
-- Кабель ВВГнг 3×2,5: 367 / 390 / 385 / 748 → медиана 390 (748 — премиальный, выброс)
('MKT-VVGNG-3X2.5','electro',null,'Кабель ВВГнг(А) 3×2,5','3 жилы × 2,5 мм², 0,66 кВ','м',390,null,null,'{}'),
-- Цемент М500 50 кг: базы 1 671–2 049, OLX 1 999, розница 3 000–3 300 → 2 000; от 100 мешков 1 850
('MKT-CEM-M500-50','dry-mixes',null,'Цемент М500, 50 кг','Портландцемент М500, мешок 50 кг','мешок',2000,100,1850,'{}'),
-- Гипсокартон Knauf
('MKT-GKL-KNAUF-12.5','dry-mixes',null,'Гипсокартон Knauf ГКЛ 12,5 мм','Лист 2500×1200×12,5 мм','лист',1330,null,null,'{}'),
('MKT-GKLV-KNAUF-12.5','dry-mixes',null,'Гипсокартон Knauf ГКЛВ влагостойкий 12,5 мм','Лист 2500×1200×12,5 мм, влагостойкий','лист',2450,null,null,'{}'),
-- Ротбанд 30 кг: 2 263 / 3 400 / 3 000 / 3 300 / 3 680 → 3 130
('MKT-ROTBAND-30','dry-mixes',null,'Штукатурка гипсовая Knauf Ротбанд, 30 кг','Гипсовая, для ручного нанесения, мешок 30 кг','мешок',3130,null,null,'{}'),
-- Минвата Knauf 50 мм: 890–950 ₸/м² → 920
('MKT-MW-KNAUF-50','insulation',null,'Утеплитель минеральная вата Knauf, 50 мм','Плита 50 мм','м²',920,null,null,'{}'),
-- Арматура А500С 12: 274 911 / 285 000 / 303 000 / 300 000 → 290 700; от 10 т −3%
('MKT-ARM-A500C-12','metal',null,'Арматура А500С 12 мм','Рифлёная, класс А500С, Ø12 мм','т',290700,10,282000,'{}');

-- группы с вариантами
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
