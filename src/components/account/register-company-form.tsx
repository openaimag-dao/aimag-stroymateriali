"use client";

import { useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { registerCompany, lookupCompanyByBin, type RegisterState } from "@/app/account/actions";
import { isValidBin, normalizeBin } from "@/lib/bin";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-signal h-[52px] text-base">
      {pending ? "Сохраняем…" : "Зарегистрировать компанию"}
    </button>
  );
}

type Requisites = { name: string; legalForm: string; director: string; address: string };
const EMPTY: Requisites = { name: "", legalForm: "ТОО", director: "", address: "" };

export function RegisterCompanyForm() {
  const [state, action] = useFormState<RegisterState, FormData>(registerCompany, undefined);
  const [req, setReq] = useState<Requisites>(EMPTY);
  const [lookup, setLookup] = useState<{ ok?: string; error?: string }>({});
  const [looking, startLookup] = useTransition();
  const lastLooked = useRef("");

  const set = (k: keyof Requisites) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setReq((r) => ({ ...r, [k]: e.target.value }));

  function fillFromRegistry(raw: string, force = false) {
    const bin = normalizeBin(raw);
    if (!isValidBin(bin) || (!force && bin === lastLooked.current)) return;
    lastLooked.current = bin;
    startLookup(async () => {
      const res = await lookupCompanyByBin(bin);
      if (!res.info) {
        setLookup({ error: res.error });
        return;
      }
      const i = res.info;
      setReq((r) => ({
        name: i.name || r.name,
        legalForm: i.legalForm,
        director: i.director ?? r.director,
        address: i.address ?? r.address,
      }));
      setLookup({ ok: "Реквизиты заполнены из реестра stat.gov.kz — проверьте их." });
    });
  }

  return (
    <form action={action} className="card flex flex-col gap-5 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[26px] font-semibold">Данные компании</h1>
        <p className="text-steel-500">
          Один раз — и реквизиты будут подставляться в КП и счета автоматически. Введите БИН — название, руководителя и
          адрес подставим из реестра.
        </p>
      </div>
      <fieldset className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        <legend className="mb-3 text-[17px] font-semibold">Компания</legend>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          БИН / ИИН
          <span className="flex gap-2">
            <input
              className="field min-w-0 flex-1"
              name="bin"
              inputMode="numeric"
              maxLength={12}
              required
              onChange={(e) => {
                setLookup({});
                fillFromRegistry(e.target.value);
              }}
            />
            <button
              type="button"
              className="btn-outline shrink-0 px-3 text-sm"
              disabled={looking}
              onClick={(e) => {
                const input = e.currentTarget.form?.elements.namedItem("bin") as HTMLInputElement | null;
                if (input && !isValidBin(input.value)) setLookup({ error: "Проверьте БИН/ИИН: 12 цифр с верной контрольной цифрой" });
                else if (input) fillFromRegistry(input.value, true);
              }}
            >
              {looking ? "Ищем…" : "Заполнить"}
            </button>
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Форма
          <select name="legalForm" className="field" value={req.legalForm} onChange={set("legalForm")}>
            <option>ТОО</option>
            <option>ИП</option>
            <option>АО</option>
            <option>Другое</option>
          </select>
        </label>
        {(lookup.ok || lookup.error) && (
          <p
            role="status"
            className={`col-span-full rounded-lg p-3 text-sm ${lookup.ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}
          >
            {lookup.ok ?? lookup.error}
          </p>
        )}
        <Field label="Название (без ТОО/ИП)" name="name" required wide value={req.name} onChange={set("name")} />
        <Field label="Руководитель" name="director" value={req.director} onChange={set("director")} />
        <Field label="Юридический адрес" name="address" value={req.address} onChange={set("address")} />
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
