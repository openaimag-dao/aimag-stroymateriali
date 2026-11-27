-- Размерные ряды: диаметр арматуры и сечение кабеля как характеристики-варианты
-- (фильтр в разделе и выбор размера на карточке группы).
insert into attributes (code, name, unit, kind, sort) values
  ('bar_diameter',  'Диаметр',  'мм',  'enum', 14),
  ('cable_section', 'Сечение',  null,  'enum', 15)
on conflict (code) do nothing;

insert into attribute_options (attribute_id, value, label, hex, sort)
select a.id, o.value, o.label, null, o.sort
from (values
  ('bar_diameter', '8',  '8 мм',  1),
  ('bar_diameter', '10', '10 мм', 2),
  ('bar_diameter', '12', '12 мм', 3),
  ('bar_diameter', '14', '14 мм', 4),
  ('bar_diameter', '16', '16 мм', 5),
  ('cable_section', '2x1.5', '2×1,5 мм²', 1),
  ('cable_section', '2x2.5', '2×2,5 мм²', 2),
  ('cable_section', '3x1.5', '3×1,5 мм²', 3),
  ('cable_section', '3x2.5', '3×2,5 мм²', 4),
  ('cable_section', '3x4',   '3×4 мм²',   5),
  ('cable_section', '3x6',   '3×6 мм²',   6)
) as o(code, value, label, sort)
join attributes a on a.code = o.code
where not exists (select 1 from attribute_options x where x.attribute_id = a.id and x.value = o.value);

insert into category_attributes (category_id, attribute_id, is_filter, is_variant, sort)
select c.id, a.id, true, true, 1
from (values ('metal', 'bar_diameter'), ('electro', 'cable_section')) as m(cat, attr)
join categories c on c.slug = m.cat
join attributes a on a.code = m.attr
on conflict (category_id, attribute_id) do nothing;
