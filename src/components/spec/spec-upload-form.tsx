"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Upload } from "lucide-react";
import { uploadSpec, type UploadState } from "@/app/spec/actions";
import { siteConfig } from "@/config/site";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-signal h-12">
      {pending ? "Загружаем…" : "Отправить на расчёт"}
    </button>
  );
}

export function SpecUploadForm() {
  const [state, action] = useFormState<UploadState, FormData>(uploadSpec, undefined);

  if (state?.ok) {
    return (
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
        <b>Заявка «{state.fileName}» принята.</b> Менеджер проверит позиции и пришлёт КП в течение{" "}
        {siteConfig.specResponseMinutes} минут в рабочее время.
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-wrap items-center gap-5 rounded-xl border-[1.5px] border-dashed border-steel-300 bg-white p-7 hover:border-signal">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-signal-50">
          <Upload className="h-7 w-7 text-signal-800" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span className="flex flex-[1_1_240px] flex-col gap-1">
          <span className="text-[17px] font-semibold">Выберите файл заявки</span>
          <span className="text-sm text-muted-foreground">Excel, PDF, Word или фото — до 20 МБ</span>
        </span>
        <input type="file" name="file" required accept=".xls,.xlsx,.csv,.pdf,.doc,.docx,.jpg,.jpeg,.png,.heic" className="text-sm" />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>
      )}
      <div>
        <Submit />
      </div>
    </form>
  );
}
