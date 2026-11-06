"use client";

import { useRef, useState, useTransition } from "react";
import { commitImport, previewImport, type CommitResult, type PreviewResult } from "@/app/admin/import/actions";
import { formatTenge } from "@/lib/money";

export function ImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [done, setDone] = useState<CommitResult | null>(null);
  const [pending, start] = useTransition();

  const formData = () => {
    const fd = new FormData();
    const f = fileRef.current?.files?.[0];
    if (f) fd.set("file", f);
    return fd;
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        className="card flex flex-wrap items-end gap-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setDone(null);
          start(async () => setPreview(await previewImport(formData())));
        }}
      >
        <label className="flex flex-[1_1_320px] flex-col gap-1.5 text-sm font-medium">
          Файл прайса (.xlsx или .csv, до 5 МБ)
          <input
            ref={fileRef}
            type="file"
            name="file"
            required
            accept=".xlsx,.csv"
            onChange={() => {
              setPreview(null);
              setDone(null);
            }}
            className="text-sm"
          />
        </label>
        <button type="submit" disabled={pending} className="btn-dark">
          {pending && !preview ? "Проверяем…" : "Проверить"}
        </button>
      </form>

      {preview?.error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{preview.error}</p>}

      {preview && !preview.error && (
        <section aria-label="Результат проверки" className="card flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px]">
              <b>{preview.fileName}</b>: строк {preview.total}, готовы к записи <b className="text-emerald-800">{preview.okCount}</b>
              {preview.errorCount ? (
                <>
                  , с ошибками <b className="text-red-700">{preview.errorCount}</b> — их пропущу
                </>
              ) : null}
            </p>
            <button
              type="button"
              disabled={pending || !preview.okCount || Boolean(done?.written)}
              onClick={() => start(async () => setDone(await commitImport(formData())))}
              className="btn-signal"
            >
              {pending ? "Записываем…" : `Записать ${preview.okCount} позиций`}
            </button>
          </div>

          {done?.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{done.error}</p>}
          {done?.written ? (
            <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              Записано позиций: {done.written}
              {done.groupsCreated ? `, новых групп: ${done.groupsCreated}` : ""}
              {done.skipped ? `, пропущено с ошибками: ${done.skipped}` : ""}. Каталог обновлён.
            </p>
          ) : null}

          <div className="max-h-[560px] overflow-auto rounded-lg border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="sticky top-0 bg-steel-50">
                <tr className="text-left text-[13px] text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">Строка</th>
                  <th scope="col" className="px-3 py-2 font-medium">Наименование</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Цена с НДС</th>
                  <th scope="col" className="px-3 py-2 font-medium">Проверка</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows?.map((r) => (
                  <tr key={r.rowNo} className={`border-t align-top ${r.errors.length ? "bg-red-50/60" : ""}`}>
                    <td className="px-3 py-2 tabular-nums">{r.rowNo}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.price !== null ? formatTenge(r.price) : "—"}</td>
                    <td className="px-3 py-2">
                      {r.errors.length === 0 && r.warnings.length === 0 && <span className="text-emerald-800">готово</span>}
                      {r.errors.map((e) => (
                        <div key={e} className="text-red-800">{e}</div>
                      ))}
                      {r.warnings.map((w) => (
                        <div key={w} className="text-amber-800">{w}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.total && preview.total > 500 ? (
            <p className="text-sm text-muted-foreground">Показаны первые 500 строк (сначала с ошибками). Записываются все строки без ошибок.</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
