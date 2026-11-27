-- Размерные ряды (ноябрь 2026): арматура А500С 8–16 мм, кабель ВВГнг(А) 2×1,5…3×6. НЕ миграция.
-- Правила как в market-shymkent-2026-11.sql. Существующие позиции (арматура 12, кабель 3×1,5 и 3×2,5)
-- входят в группы; цена кабеля 3×2,5 исправлена (была ниже 3×1,5).
begin;
create temp table seed (
  sku text, cat text, grp text, name text, spec text, unit text, price numeric, weight numeric, attrs jsonb
) on commit drop;

insert into seed values
-- Арматура: 8 мм — 289 000 ₸/т, 10 мм — 283 000 (Шымкент); 12 мм — прежние 290 700;
-- 16 мм — 254 564 / 259 759 → 257 160; 14 мм — среднее между 12 и 16 мм (прямой цены не найдено)
('MKT-ARM-A500C-8',  'metal','Арматура А500С','Арматура А500С 8 мм', 'Рифлёная, ГОСТ 34028, длина 11,7 м','т',289000,1000,'{"bar_diameter":"8"}'),
('MKT-ARM-A500C-10', 'metal','Арматура А500С','Арматура А500С 10 мм','Рифлёная, ГОСТ 34028, длина 11,7 м','т',283000,1000,'{"bar_diameter":"10"}'),
('MKT-ARM-A500C-12', 'metal','Арматура А500С','Арматура А500С 12 мм','Рифлёная, ГОСТ 34028, длина 11,7 м','т',290700,1000,'{"bar_diameter":"12"}'),
('MKT-ARM-A500C-14', 'metal','Арматура А500С','Арматура А500С 14 мм','Рифлёная, ГОСТ 34028, длина 11,7 м','т',273930,1000,'{"bar_diameter":"14"}'),
('MKT-ARM-A500C-16', 'metal','Арматура А500С','Арматура А500С 16 мм','Рифлёная, ГОСТ 34028, длина 11,7 м','т',257160,1000,'{"bar_diameter":"16"}'),
-- Кабель ₸/м: 2×1,5 — 240 / 320 → 280; 2×2,5 — 380 / 580 → 480; 3×1,5 — прежние 400;
-- 3×2,5 — 530 / 770 → 650; 3×4 — 890 / 1 198 → 1 040; 3×6 — 1 290
('MKT-VVGNG-2X1.5','electro','Кабель ВВГнг(А)','Кабель ВВГнг(А) 2×1,5','Медный, негорючий, 0,66 кВ, ГОСТ','м',280,0.09,'{"cable_section":"2x1.5"}'),
('MKT-VVGNG-2X2.5','electro','Кабель ВВГнг(А)','Кабель ВВГнг(А) 2×2,5','Медный, негорючий, 0,66 кВ, ГОСТ','м',480,0.13,'{"cable_section":"2x2.5"}'),
('MKT-VVGNG-3X1.5','electro','Кабель ВВГнг(А)','Кабель ВВГнг(А) 3×1,5','Медный, негорючий, 0,66 кВ, ГОСТ','м',400,0.12,'{"cable_section":"3x1.5"}'),
('MKT-VVGNG-3X2.5','electro','Кабель ВВГнг(А)','Кабель ВВГнг(А) 3×2,5','Медный, негорючий, 0,66 кВ, ГОСТ','м',650,0.17,'{"cable_section":"3x2.5"}'),
('MKT-VVGNG-3X4',  'electro','Кабель ВВГнг(А)','Кабель ВВГнг(А) 3×4',  'Медный, негорючий, 0,66 кВ, ГОСТ','м',1040,0.25,'{"cable_section":"3x4"}'),
('MKT-VVGNG-3X6',  'electro','Кабель ВВГнг(А)','Кабель ВВГнг(А) 3×6',  'Медный, негорючий, 0,66 кВ, ГОСТ','м',1290,0.33,'{"cable_section":"3x6"}');

insert into product_groups (category_id, slug, name)
select distinct c.id, 'mkt-' || substr(md5(s.cat || s.grp), 1, 10), s.grp
from seed s join categories c on c.slug = s.cat
on conflict (slug) do nothing;

insert into products (sku, category_id, group_id, name, spec, unit, price_kzt, price_locked, in_stock, lead_time_days, is_active, import_batch, weight_kg)
select s.sku, c.id, g.id, s.name, s.spec, s.unit, s.price, true, false, 3, true, 'Рынок Шымкент, ноябрь 2026 (ориентир)', s.weight
from seed s
join categories c on c.slug = s.cat
join product_groups g on g.slug = 'mkt-' || substr(md5(s.cat || s.grp), 1, 10)
on conflict (sku) do update set group_id = excluded.group_id, price_kzt = excluded.price_kzt, name = excluded.name,
  spec = excluded.spec, weight_kg = excluded.weight_kg, updated_at = now(), price_updated_at = now();

delete from product_attributes where product_id in (select p.id from products p join seed s on s.sku = p.sku);
insert into product_attributes (product_id, attribute_id, value)
select p.id, a.id, kv.value
from seed s join products p on p.sku = s.sku
cross join lateral jsonb_each_text(s.attrs) kv
join attributes a on a.code = kv.key;
commit;
