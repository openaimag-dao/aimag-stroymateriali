-- Разделы «Крепёж», «Лакокраска и химия», «Спецодежда и СИЗ» с подразделами.
insert into categories (slug, name, sort) values
  ('fasteners', 'Крепёж', 9),
  ('paints', 'Лакокраска и химия', 10),
  ('ppe', 'Спецодежда и СИЗ', 11)
on conflict (slug) do nothing;

insert into categories (parent_id, slug, name, sort)
select p.id, s.slug, s.name, s.sort
from (values
  ('fasteners', 'screws',          'Саморезы и шурупы',            1),
  ('fasteners', 'anchors',         'Анкеры и дюбели',              2),
  ('paints',    'paints-primers',  'Краски, эмали, грунтовки',     1),
  ('paints',    'foam-sealants',   'Монтажная пена и герметики',   2),
  ('ppe',       'gloves',          'Рабочие перчатки',             1),
  ('ppe',       'ppe-gear',        'Каски, жилеты, защита',        2)
) as s(parent, slug, name, sort)
join categories p on p.slug = s.parent
on conflict (slug) do nothing;
