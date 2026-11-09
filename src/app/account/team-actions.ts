"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/server";
import { emailInvite } from "@/lib/notifications";

export type TeamState = { ok?: string; error?: string } | undefined;

const errText: Record<string, string> = {
  not_owner: "Приглашать и убирать сотрудников может только владелец кабинета.",
  bad_email: "Проверьте email.",
  bad_role: "Выберите роль.",
  already_member: "Этот сотрудник уже в кабинете.",
  too_many_invites: "Слишком много открытых приглашений — отзовите лишние.",
  cannot_remove_self: "Себя убрать нельзя.",
  member_not_found: "Сотрудник не найден.",
  invite_not_found: "Приглашение не найдено или уже принято.",
  already_in_company: "Вы уже состоите в другой компании. Чтобы перейти, позвоните нам.",
  bad_name: "Укажите имя.",
};
const text = (m: string, fallback: string) => Object.entries(errText).find(([k]) => m.includes(k))?.[1] ?? fallback;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Проверьте email"),
  role: z.enum(["buyer", "accountant"]),
});

export async function inviteMember(_prev: TeamState, form: FormData): Promise<TeamState> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  const supabase = await getSupabase();
  if (!supabase) return { error: "База не подключена" };

  const { error } = await supabase.rpc("invite_member", { p_email: parsed.data.email, p_role: parsed.data.role });
  if (error) return { error: text(error.message, "Не удалось пригласить. Попробуйте ещё раз.") };

  const { data: company } = await supabase.from("companies").select("name, legal_form").limit(1).maybeSingle();
  const sent = company ? await emailInvite(parsed.data.email, parsed.data.role, company) : "failed";
  revalidatePath("/account");
  return {
    ok:
      sent === "sent"
        ? `Приглашение отправлено на ${parsed.data.email}.`
        : `Приглашение создано. Попросите сотрудника войти на сайт с адресом ${parsed.data.email} и нажать «Присоединиться».`,
  };
}

export async function revokeInvite(inviteId: string) {
  const supabase = await getSupabase();
  await supabase?.rpc("revoke_invite", { p_invite_id: inviteId });
  revalidatePath("/account");
}

export async function removeMember(userId: string) {
  const supabase = await getSupabase();
  await supabase?.rpc("remove_member", { p_user_id: userId });
  revalidatePath("/account");
}

const acceptSchema = z.object({
  fullName: z.string().trim().min(2, "Укажите имя"),
  phone: z.string().trim().min(10, "Укажите телефон"),
});

export async function acceptInvite(inviteId: string, _prev: TeamState, form: FormData): Promise<TeamState> {
  const parsed = acceptSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  const supabase = await getSupabase();
  if (!supabase) return { error: "База не подключена" };
  const { error } = await supabase.rpc("accept_invite", {
    p_invite_id: inviteId,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
  });
  if (error) return { error: text(error.message, "Не удалось присоединиться. Попробуйте ещё раз.") };
  revalidatePath("/", "layout");
  return { ok: "Готово" };
}
