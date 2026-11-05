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
    name: "Трубы и сантехника",
    items: "Трубы ППР и ПНД, фитинги, запорная арматура",
    icon: "Wrench",
  },
  {
    slug: "roofing",
    name: "Кровля и фасад",
    items: "Профлист, металлочерепица, мембраны, водосток",
    icon: "Home",
  },
] as const;

export type CategorySlug = (typeof categories)[number]["slug"];
