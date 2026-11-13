/** Публичный адрес сайта для canonical, sitemap и писем. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://aimag-stroymateriali.vercel.app").replace(/\/$/, "");

export const siteConfig = {
  name: "AIMAG Stroymateriali",
  description:
    "Стройматериалы оптом для ТОО и ИП Казахстана: оптовые цены с НДС, КП и счёт за минуты, доставка 1–3 дня.",
  phone: "+7 705 615-17-17",
  phoneHref: "tel:+77056151717",
  email: "sales@aimag.kz",
  city: "Шымкент",
  vatPct: 16,
  quoteValidDays: 7,
  specResponseMinutes: 15,
};

/** Стартовые категории — совпадают с seed в supabase/migrations/0001_init.sql. */
export const categories = [
  {
    slug: "electro",
    name: "Электротехника и кабель",
    items: "Кабель ВВГ, провод, автоматы, щиты, светильники",
    icon: "Zap",
  },
  {
    slug: "dry-mixes",
    name: "Сухие смеси и гипсокартон",
    items: "Штукатурки, шпатлёвки, клей для плитки, ГКЛ, профиль",
    icon: "PaintBucket",
  },
  {
    slug: "insulation",
    name: "Теплоизоляция",
    items: "Минвата, стекловата, пенополистирол, плёнки",
    icon: "Layers",
  },
  {
    slug: "metal",
    name: "Металлопрокат",
    items: "Арматура, профтруба, уголок, лист",
    icon: "Construction",
  },
  {
    slug: "pipes",
    name: "Сантехника и трубы",
    items: "Трубы PP-R и ПНД, фитинги, муфты, краны, канализация",
    icon: "Wrench",
  },
  {
    slug: "roofing",
    name: "Кровля",
    items: "Металлочерепица, профнастил, доборные элементы, водосток",
    icon: "Home",
  },
  {
    slug: "facade",
    name: "Фасад",
    items: "Сайдинг, фасадные панели, подсистема вентфасада",
    icon: "Building2",
  },
] as const;

export type CategorySlug = (typeof categories)[number]["slug"];
