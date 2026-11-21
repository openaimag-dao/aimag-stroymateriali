-- Стартовый каталог, четвёртая партия (ноябрь 2026): инструменты и оборудование. НЕ миграция.
-- Правила как в market-shymkent-2026-11.sql: средние открытые цены с НДС по Шымкенту/Казахстану,
-- округление до 10 ₸, цены закреплены, «под заказ, 3 дня». Где у модели одна цена дилера — взята она.
begin;
create temp table seed (
  sku text, cat text, grp text, name text, spec text, unit text, price numeric,
  tier_qty numeric, tier_price numeric, attrs jsonb
) on commit drop;

insert into seed values
-- Makita 9558HN: 45 355 / 52 265 / 62 600 / 43 578 → 50 950
('MKT-TOOL-MAKITA-9558HN','power-tools',null,'УШМ (болгарка) Makita 9558HN, 125 мм','840 Вт, диск 125 мм, 11 000 об/мин','шт',50950,null,null,'{}'),
-- Makita HR2470: 92 820 / 92 820 / 116 743 → 100 790
('MKT-TOOL-MAKITA-HR2470','power-tools',null,'Перфоратор Makita HR2470, SDS-plus','780 Вт, 2,4 Дж, кейс','шт',100790,null,null,'{}'),
-- Makita DF333DWYE: цена официального дилера 98 070 (два магазина)
('MKT-TOOL-MAKITA-DF333','power-tools',null,'Дрель-шуруповёрт аккумуляторная Makita DF333DWYE','12 В, 2 АКБ 1,5 Ач, зарядка, кейс','шт',98070,null,null,'{}'),
-- Уровень алюминиевый 1000 мм: 3 067 (Шымкент) / 3 350 / 2 690 → 3 040
('MKT-TOOL-LEVEL-1000','hand-tools',null,'Уровень строительный алюминиевый 1000 мм','3 глазка, точность 1 мм/м','шт',3040,null,null,'{}'),
-- Рулетка 5 м × 19 мм: 1 440 / 1 440 / 1 211 → 1 360
('MKT-TOOL-TAPE-5M','hand-tools',null,'Рулетка измерительная 5 м × 19 мм','Обрезиненный корпус, фиксатор ленты','шт',1360,null,null,'{}'),
-- Бетономешалка Вихрь БМ-180: 111 390 (Шымкент) / 121 890 → 116 640
('MKT-EQ-MIXER-VIHR-180','construction-equipment',null,'Бетономешалка Вихрь БМ-180','Барабан 180 л, загрузка 130 л, 800 Вт, 220 В','шт',116640,null,null,'{}'),
-- Тачка двухколёсная 100 л: 26 250 / 28 000 / 29 500 / 26 425 / 30 000 / 32 000 → 28 700
('MKT-EQ-BARROW-100-2W','construction-equipment',null,'Тачка строительная двухколёсная 100 л','Грузоподъёмность 200–250 кг, пневмоколёса','шт',28700,null,null,'{}'),
-- Ресанта САИ-220: 50 000 (Шымкент) / 49 495 / 52 090 → 50 530
('MKT-EQ-WELD-RESANTA-220','construction-equipment',null,'Сварочный инвертор Ресанта САИ-220','MMA, ток до 220 А, электрод до 5 мм','шт',50530,null,null,'{}'),
-- Круг отрезной по металлу 125×1,2: 313 / 210 / 280 / 260 → 270
('MKT-CONS-CUT-125-1.2','tool-consumables',null,'Круг отрезной по металлу 125×1,2×22,2 мм','Для УШМ, сталь и нержавейка','шт',270,null,null,'{}'),
-- Бур SDS-plus 10×160: 935 / 799 / 945 / 862 / 590 → 830
('MKT-CONS-BUR-SDS-10-160','tool-consumables',null,'Бур по бетону SDS-plus 10×160 мм','Твердосплавная пластина, бетон и кирпич','шт',830,null,null,'{}'),
-- ЗУБР Универсал 125 мм сегментный: цена дилера 1 860
('MKT-CONS-DIAM-125-SEG','tool-consumables',null,'Диск алмазный сегментный 125×22,2 мм ЗУБР «Универсал»','Сухой рез: бетон, кирпич, камень','шт',1860,null,null,'{}');

insert into products (sku, category_id, group_id, name, spec, unit, price_kzt, price_locked, in_stock, lead_time_days, is_active, import_batch)
select s.sku, c.id, null, s.name, s.spec, s.unit, s.price, true, false, 3, true, 'Рынок Шымкент, ноябрь 2026 (ориентир)'
from seed s join categories c on c.slug = s.cat
on conflict (sku) do update set price_kzt = excluded.price_kzt, name = excluded.name, spec = excluded.spec, updated_at = now(), price_updated_at = now();
commit;
