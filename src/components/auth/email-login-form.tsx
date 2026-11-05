"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function EmailLoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setState("sending");
    const back = next?.startsWith("/") ? next : "/account";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(back)}` },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        Ссылка для входа отправлена на <b>{email}</b>. Откройте письмо и нажмите кнопку входа.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2.5">
      <label className="flex flex-[1_1_260px] flex-col gap-1.5 text-sm font-medium">
        Рабочий email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field h-[52px] text-base"
        />
      </label>
      <button type="submit" disabled={state === "sending"} className="btn-dark h-[52px] px-6 text-base">
        {state === "sending" ? "Отправляем…" : "Получить ссылку"}
      </button>
      {state === "error" && (
        <p role="alert" className="w-full text-sm text-red-700">Не удалось отправить письмо: {error}</p>
      )}
    </form>
  );
}
