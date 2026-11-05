"use client";

import { useFormState, useFormStatus } from "react-dom";
import { registerCompany, type RegisterState } from "@/app/account/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-signal h-[52px] text-base">
      {pending ? "Сохраняем…" : "Зарегистрировать компанию"}
    </button>
  );
}

export function RegisterCompanyForm() {
  const [state, action] = useFormState<RegisterState, FormData>(registerCompany, undefined);

  return (
    <form action={action} className="card flex flex-col gap-5 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[26px] font-semibold">Данные компании</h1>
        <p className="text-steel-500">
          Один раз — и реквизиты будут подставляться в КП и счета автоматически. Автозаполнение по БИН подключим следующим шагом.
        </p>
      </div>
      <fieldset className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        <legend className="mb-3 text-[17px] font-semibold">Компания</legend>
        <Field label="БИН / ИИН" name="bin" inputMode="numeric" maxLength={12} required />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Форма
          <select name="legalForm" className="field" defaultValue="ТОО">
            <option>ТОО</option>
            <option>ИП</option>
            <option>АО</option>
            <option>Другое</option>
          </select>
        </label>
        <Field label="Название" name="name" required wide />
        <Field label="Руководитель" name="director" />
        <Field label="Юридический адрес" name="address" />
      </fieldset>
      <fieldset className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        <legend className="mb-3 text-[17px] font-semibold">Контакт и банк</legend>
        <Field label="Контактное лицо" name="fullName" autoComplete="name" required />
        <Field label="Телефон" name="phone" type="tel" autoComplete="tel" placeholder="+7" required />
        <Field label="Email для счетов" name="invoiceEmail" type="email" />
        <Field label="БИК банка" name="bik" />
        <Field label="ИИК (IBAN)" name="iban" placeholder="KZ…" wide />
      </fieldset>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>
      )}
      <SubmitButton />
    </form>
  );
}

function Field({ label, wide, ...props }: { label: string; wide?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-medium ${wide ? "col-span-full" : ""}`}>
      {label}
      <input className="field" {...props} />
    </label>
  );
}
