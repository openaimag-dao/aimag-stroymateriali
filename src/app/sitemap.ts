import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { categories as staticCategories, siteUrl } from "@/config/site";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

export const revalidate = 3600;

/** Разделы каталога: из базы (структура видна всем), без базы — стартовый список. */
async function categorySlugs(): Promise<string[]> {
  if (!isSupabaseConfigured()) return staticCategories.map((c) => c.slug);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.from("categories").select("slug").order("sort");
  if (error || !data?.length) return staticCategories.map((c) => c.slug);
  return data.map((r) => r.slug as string);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/spec`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];
  for (const slug of await categorySlugs()) {
    pages.push({ url: `${siteUrl}/catalog/${slug}`, lastModified: now, changeFrequency: "daily", priority: 0.8 });
  }
  return pages;
}
