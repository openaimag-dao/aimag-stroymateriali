import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";

/**
 * Admin guard for pages and server actions. RLS enforces staff rights in the DB too;
 * this only decides what to render. Non-staff get a 404, not a hint that /admin exists.
 */
export async function requireStaff() {
  const supabase = await getSupabase();
  if (!supabase) redirect("/login");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/admin");
  const { data } = await supabase.from("staff").select("role").eq("user_id", auth.user.id).maybeSingle();
  if (!data) notFound();
  return { supabase, user: auth.user, role: data.role as "admin" | "manager" };
}

export async function isStaff(): Promise<boolean> {
  const supabase = await getSupabase();
  if (!supabase) return false;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data } = await supabase.from("staff").select("role").eq("user_id", auth.user.id).maybeSingle();
  return Boolean(data);
}
