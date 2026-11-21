-- Раздел «Инструменты и оборудование»: электроинструмент, ручной инструмент,
-- строительное оборудование и расходники. Наценка — по умолчанию 20 %.
insert into categories (slug, name, sort) values ('tools', 'Инструменты и оборудование', 8)
on conflict (slug) do nothing;

insert into categories (parent_id, slug, name, sort)
select p.id, s.slug, s.name, s.sort
from (values
  ('tools', 'power-tools',            'Электроинструмент',          1),
  ('tools', 'hand-tools',             'Ручной и мерительный инструмент', 2),
  ('tools', 'construction-equipment', 'Строительное оборудование',  3),
  ('tools', 'tool-consumables',       'Расходники: круги, диски, буры', 4)
) as s(parent, slug, name, sort)
join categories p on p.slug = s.parent
on conflict (slug) do nothing;
