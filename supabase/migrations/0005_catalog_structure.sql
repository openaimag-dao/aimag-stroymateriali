-- Структура каталога: подразделы, характеристики, варианты товаров.
-- Каждый вариант (толщина × покрытие × цвет, диаметр × PN …) — отдельная строка products
-- со своей ценой, поэтому КП и счёт работают без изменений. Варианты одного товара
-- объединены в группу (product_groups), характеристики — в product_attributes.

-- ── Разделы ────────────────────────────────────────────────────
update categories set name = 'Кровля' where slug = 'roofing';
update categories set name = 'Сантехника и трубы' where slug = 'pipes';
insert into categories (slug, name, sort) values ('facade', 'Фасад', 7);

insert into categories (parent_id, slug, name, sort)
select p.id, s.slug, s.name, s.sort
from (values
  ('roofing', 'metal-tile',       'Металлочерепица',              1),
  ('roofing', 'profnastil',       'Профнастил',                   2),
  ('roofing', 'roof-extras',      'Доборные элементы кровли',     3),
  ('roofing', 'gutters',          'Водосточные системы',          4),
  ('roofing', 'roof-membranes',   'Кровельные плёнки и мембраны', 5),
  ('roofing', 'roof-fasteners',   'Кровельный крепёж',            6),
  ('facade',  'siding',           'Сайдинг',                      1),
  ('facade',  'siding-extras',    'Комплектующие для сайдинга',   2),
  ('facade',  'facade-panels',    'Фасадные панели',              3),
  ('facade',  'vent-facade',      'Подсистема вентфасада',        4),
  ('facade',  'facade-membranes', 'Ветро- и влагозащита',         5),
  ('pipes',   'ppr-pipes',        'Трубы PP-R',                   1),
  ('pipes',   'ppr-fittings',     'Фитинги PP-R',                 2),
  ('pipes',   'pe-pipes',         'Трубы ПНД',                    3),
  ('pipes',   'pe-fittings',      'Компрессионные фитинги ПНД',   4),
  ('pipes',   'sewer',            'Канализация',                  5),
  ('pipes',   'valves',           'Запорная арматура',            6)
) as s(parent, slug, name, sort)
join categories p on p.slug = s.parent;

-- ── Характеристики ─────────────────────────────────────────────
create table attributes (
  id    serial primary key,
  code  text unique not null,
  name  text not null,
  unit  text,
  kind  text not null default 'enum' check (kind in ('enum', 'color')),
  sort  int  not null default 0
);

create table attribute_options (
  attribute_id int  not null references attributes(id) on delete cascade,
  value        text not null,                       -- машинное значение: '0.45', 'RAL3005', 'c21'
  label        text not null,                       -- подпись: '0,45 мм', 'RAL 3005 Красное вино'
  hex          text check (hex ~ '^#[0-9A-Fa-f]{6}$'), -- образец цвета (на экране приблизительный)
  sort         int  not null default 0,
  primary key (attribute_id, value)
);

create table category_attributes (
  category_id  int not null references categories(id) on delete cascade,
  attribute_id int not null references attributes(id) on delete cascade,
  is_filter    boolean not null default true,   -- показывать в фильтрах раздела
  is_variant   boolean not null default false,  -- выбирать на карточке товара
  sort         int not null default 0,
  primary key (category_id, attribute_id)
);

create table product_groups (
  id          uuid primary key default gen_random_uuid(),
  category_id int  not null references categories(id),
  slug        text unique not null,
  name        text not null,               -- «Профнастил С21», «Труба PP-R PN20»
  description text,
  image_url   text,
  sort        int  not null default 0,
  is_active   boolean not null default true
);
create index product_groups_category_idx on product_groups (category_id) where is_active;

alter table products add column group_id uuid references product_groups(id) on delete set null;
create index products_group_idx on products (group_id);

create table product_attributes (
  product_id   uuid not null references products(id) on delete cascade,
  attribute_id int  not null,
  value        text not null,
  primary key (product_id, attribute_id),
  foreign key (attribute_id, value) references attribute_options (attribute_id, value)
);
create index product_attributes_value_idx on product_attributes (attribute_id, value);

-- ── Права: структура каталога видна всем, цены и варианты — после входа ──
do $$
declare t text;
begin
  foreach t in array array['attributes','attribute_options','category_attributes','product_groups'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_read', t);
    execute format('create policy %I on %I for all to authenticated using (is_staff()) with check (is_staff())', t || '_staff', t);
  end loop;
end $$;
create policy categories_read_anon on categories for select to anon using (true);

alter table product_attributes enable row level security;
create policy product_attributes_read on product_attributes for select to authenticated using (true);
create policy product_attributes_staff on product_attributes for all to authenticated using (is_staff()) with check (is_staff());

-- ── Справочник значений ────────────────────────────────────────
insert into attributes (code, name, unit, kind, sort) values
  ('thickness',       'Толщина металла',   'мм', 'enum',  1),
  ('coating',         'Покрытие',          null, 'enum',  2),
  ('ral',             'Цвет',              null, 'color', 3),
  ('proflist_profile','Профиль',           null, 'enum',  4),
  ('tile_profile',    'Профиль',           null, 'enum',  5),
  ('siding_material', 'Материал',          null, 'enum',  6),
  ('siding_profile',  'Профиль',           null, 'enum',  7),
  ('panel_material',  'Материал панели',   null, 'enum',  8),
  ('pipe_diameter',   'Диаметр',           'мм', 'enum',  9),
  ('pn',              'Давление',          null, 'enum', 10),
  ('reinforcement',   'Армирование',       null, 'enum', 11),
  ('fitting_type',    'Тип',               null, 'enum', 12),
  ('thread',          'Резьба',            null, 'enum', 13);

insert into attribute_options (attribute_id, value, label, hex, sort)
select a.id, o.value, o.label, o.hex, o.sort
from (values
  ('thickness', '0.40', '0,40 мм', null, 1),
  ('thickness', '0.45', '0,45 мм', null, 2),
  ('thickness', '0.50', '0,50 мм', null, 3),
  ('thickness', '0.55', '0,55 мм', null, 4),
  ('thickness', '0.70', '0,70 мм', null, 5),

  ('coating', 'zinc',  'Оцинковка',         null, 1),
  ('coating', 'pe',    'Полиэстер',         null, 2),
  ('coating', 'mpe',   'Матовый полиэстер', null, 3),
  ('coating', 'pural', 'Пурал',             null, 4),

  ('ral', 'RAL1014', 'RAL 1014 Слоновая кость',          '#DDC49A',  1),
  ('ral', 'RAL1015', 'RAL 1015 Светлая слоновая кость',  '#E6D2B5',  2),
  ('ral', 'RAL3005', 'RAL 3005 Красное вино',            '#5E2129',  3),
  ('ral', 'RAL3009', 'RAL 3009 Оксидно-красный',         '#6C3B2A',  4),
  ('ral', 'RAL3011', 'RAL 3011 Коричнево-красный',       '#792423',  5),
  ('ral', 'RAL5002', 'RAL 5002 Ультрамарин',             '#20214F',  6),
  ('ral', 'RAL5005', 'RAL 5005 Сигнальный синий',        '#154889',  7),
  ('ral', 'RAL6002', 'RAL 6002 Зелёный лист',            '#2D572C',  8),
  ('ral', 'RAL6005', 'RAL 6005 Зелёный мох',             '#2F4538',  9),
  ('ral', 'RAL7004', 'RAL 7004 Сигнальный серый',        '#969992', 10),
  ('ral', 'RAL7024', 'RAL 7024 Графитовый серый',        '#474A51', 11),
  ('ral', 'RAL8004', 'RAL 8004 Медно-коричневый',        '#8E402A', 12),
  ('ral', 'RAL8017', 'RAL 8017 Шоколадно-коричневый',    '#45322E', 13),
  ('ral', 'RAL9003', 'RAL 9003 Сигнальный белый',        '#F4F4F4', 14),
  ('ral', 'RAL9006', 'RAL 9006 Бело-алюминиевый',        '#A5A5A5', 15),

  ('proflist_profile', 'c8',   'С8',   null, 1),
  ('proflist_profile', 'c10',  'С10',  null, 2),
  ('proflist_profile', 'c20',  'С20',  null, 3),
  ('proflist_profile', 'c21',  'С21',  null, 4),
  ('proflist_profile', 'ns35', 'НС35', null, 5),
  ('proflist_profile', 'n60',  'Н60',  null, 6),
  ('proflist_profile', 'n75',  'Н75',  null, 7),

  ('tile_profile', 'monterrey',      'Монтеррей',      null, 1),
  ('tile_profile', 'supermonterrey', 'Супермонтеррей', null, 2),
  ('tile_profile', 'kaskad',         'Каскад',         null, 3),

  ('siding_material', 'pvc',   'Виниловый (ПВХ)', null, 1),
  ('siding_material', 'metal', 'Металлический',   null, 2),

  ('siding_profile', 'ship',       'Корабельная доска', null, 1),
  ('siding_profile', 'blockhouse', 'Блок-хаус',         null, 2),
  ('siding_profile', 'timber',     'Брус',              null, 3),
  ('siding_profile', 'vertical',   'Вертикальный',      null, 4),

  ('panel_material', 'fibercement', 'Фиброцемент',          null, 1),
  ('panel_material', 'acp',         'Композит (АКП)',       null, 2),
  ('panel_material', 'pvc-stone',   'ПВХ под камень/кирпич', null, 3),
  ('panel_material', 'metal-cassette', 'Металлокассета',    null, 4),

  ('pipe_diameter', '16',  '16 мм',  null,  1),
  ('pipe_diameter', '20',  '20 мм',  null,  2),
  ('pipe_diameter', '25',  '25 мм',  null,  3),
  ('pipe_diameter', '32',  '32 мм',  null,  4),
  ('pipe_diameter', '40',  '40 мм',  null,  5),
  ('pipe_diameter', '50',  '50 мм',  null,  6),
  ('pipe_diameter', '63',  '63 мм',  null,  7),
  ('pipe_diameter', '75',  '75 мм',  null,  8),
  ('pipe_diameter', '90',  '90 мм',  null,  9),
  ('pipe_diameter', '110', '110 мм', null, 10),
  ('pipe_diameter', '160', '160 мм', null, 11),

  ('pn', 'pn10', 'PN10', null, 1),
  ('pn', 'pn16', 'PN16', null, 2),
  ('pn', 'pn20', 'PN20', null, 3),
  ('pn', 'pn25', 'PN25', null, 4),

  ('reinforcement', 'none',  'Без армирования', null, 1),
  ('reinforcement', 'fiber', 'Стекловолокно',   null, 2),
  ('reinforcement', 'al',    'Алюминий',        null, 3),

  ('fitting_type', 'coupling', 'Муфта',                       null,  1),
  ('fitting_type', 'reducer',  'Муфта переходная',            null,  2),
  ('fitting_type', 'male',     'Муфта комбинированная НР',    null,  3),
  ('fitting_type', 'female',   'Муфта комбинированная ВР',    null,  4),
  ('fitting_type', 'elbow90',  'Угольник 90°',                null,  5),
  ('fitting_type', 'elbow45',  'Угольник 45°',                null,  6),
  ('fitting_type', 'tee',      'Тройник',                     null,  7),
  ('fitting_type', 'cap',      'Заглушка',                    null,  8),
  ('fitting_type', 'union',    'Американка',                  null,  9),
  ('fitting_type', 'bypass',   'Обвод',                       null, 10),
  ('fitting_type', 'valve',    'Кран шаровой',                null, 11),

  ('thread', '1/2',   '1/2″',   null, 1),
  ('thread', '3/4',   '3/4″',   null, 2),
  ('thread', '1',     '1″',     null, 3),
  ('thread', '1-1/4', '1 1/4″', null, 4),
  ('thread', '1-1/2', '1 1/2″', null, 5),
  ('thread', '2',     '2″',     null, 6)
) as o(code, value, label, hex, sort)
join attributes a on a.code = o.code;

-- ── Какие характеристики у какого подраздела (f — фильтр, v — выбор на карточке) ──
insert into category_attributes (category_id, attribute_id, is_filter, is_variant, sort)
select c.id, a.id, m.f, m.v, m.sort
from (values
  ('metal-tile',     'tile_profile',     true,  true,  1),
  ('metal-tile',     'thickness',        true,  true,  2),
  ('metal-tile',     'coating',          true,  true,  3),
  ('metal-tile',     'ral',              true,  true,  4),
  ('profnastil',     'proflist_profile', true,  true,  1),
  ('profnastil',     'thickness',        true,  true,  2),
  ('profnastil',     'coating',          true,  true,  3),
  ('profnastil',     'ral',              true,  true,  4),
  ('roof-extras',    'coating',          true,  true,  1),
  ('roof-extras',    'ral',              true,  true,  2),
  ('gutters',        'ral',              true,  true,  1),
  ('roof-fasteners', 'ral',              true,  true,  1),
  ('siding',         'siding_material',  true,  false, 1),
  ('siding',         'siding_profile',   true,  true,  2),
  ('siding',         'thickness',        true,  true,  3),
  ('siding',         'ral',              true,  true,  4),
  ('siding-extras',  'siding_material',  true,  false, 1),
  ('siding-extras',  'ral',              true,  true,  2),
  ('facade-panels',  'panel_material',   true,  true,  1),
  ('facade-panels',  'ral',              true,  true,  2),
  ('ppr-pipes',      'pipe_diameter',    true,  true,  1),
  ('ppr-pipes',      'pn',               true,  true,  2),
  ('ppr-pipes',      'reinforcement',    true,  true,  3),
  ('ppr-fittings',   'fitting_type',     true,  true,  1),
  ('ppr-fittings',   'pipe_diameter',    true,  true,  2),
  ('ppr-fittings',   'thread',           true,  true,  3),
  ('pe-pipes',       'pipe_diameter',    true,  true,  1),
  ('pe-pipes',       'pn',               true,  true,  2),
  ('pe-fittings',    'fitting_type',     true,  true,  1),
  ('pe-fittings',    'pipe_diameter',    true,  true,  2),
  ('pe-fittings',    'thread',           true,  true,  3),
  ('sewer',          'pipe_diameter',    true,  true,  1),
  ('valves',         'thread',           true,  true,  1)
) as m(cat, attr, f, v, sort)
join categories c on c.slug = m.cat
join attributes a on a.code = m.attr;
