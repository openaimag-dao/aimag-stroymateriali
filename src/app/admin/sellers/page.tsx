/* eslint-disable @next/next/no-img-element -- stamp previews come from Supabase Storage */
import { requireStaff } from "@/lib/staff";
import { saveSeller, uploadSellerImage } from "./actions";

type Props = { searchParams: Promise<{ msg?: string }> };

export default async function SellersPage({ searchParams }: Props) {
  const { msg } = await searchParams;
  const { supabase } = await requireStaff();
  const { data: sellers } = await supabase
    .from("sellers")
    .select("code, name, bin, director, address, bank_name, bik, iban, kbe, knp, phone, stamp_url, signature_url")
    .order("id");

  // previews via short-lived signed links (the bucket is private)
  const paths = (sellers ?? []).flatMap((s) => [s.stamp_url, s.signature_url]).filter((p): p is string => Boolean(p));
  const signed = paths.length ? (await supabase.storage.from("branding").createSignedUrls(paths, 300)).data ?? [] : [];
  const preview = new Map(signed.map((x) => [x.path, x.signedUrl]));

  return (
    <>
      <h1 className="font-display text-[28px] font-semibold">Реквизиты продавцов</h1>
      <p className="text-sm text-muted-foreground">
        Подставляются в КП и счета. По умолчанию документы выходят от ИП AIMAG; для клиентов, где мешает статус в реестре Самрук-Казына,
        переключите продавца на ЖК Bereke в карточке КП.
      </p>
      {msg && <p role="status" className="rounded-lg bg-steel-100 p-3 text-sm">{msg}</p>}

      {(sellers ?? []).map((s) => (
        <section key={s.code} aria-labelledby={`s-${s.code}`} className="card flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`s-${s.code}`} className="text-lg font-semibold">{s.name}</h2>
            <span className="text-sm text-muted-foreground">БИН {s.bin} · тел. {s.phone}</span>
          </div>
          <form action={saveSeller} className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            <input type="hidden" name="code" value={s.code} />
            <Field label="Директор (как в подписи)" name="director" value={s.director} required />
            <Field label="Адрес" name="address" value={s.address} />
            <Field label="Банк" name="bank_name" value={s.bank_name} placeholder="АО «Банк ЦентрКредит»" />
            <Field label="БИК" name="bik" value={s.bik} />
            <Field label="ИИК (IBAN)" name="iban" value={s.iban} placeholder="KZ…" />
            <Field label="Кбе" name="kbe" value={s.kbe} />
            <Field label="Код назначения платежа" name="knp" value={s.knp} required />
            <div className="col-span-full">
              <button type="submit" className="btn-dark">Сохранить реквизиты</button>
            </div>
          </form>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 border-t pt-4">
            {(["stamp", "signature"] as const).map((kind) => {
              const path = kind === "stamp" ? s.stamp_url : s.signature_url;
              const url = path ? preview.get(path) : undefined;
              return (
                <form key={kind} action={uploadSellerImage} className="flex flex-col gap-2">
                  <input type="hidden" name="code" value={s.code} />
                  <input type="hidden" name="kind" value={kind} />
                  <span className="text-sm font-semibold">{kind === "stamp" ? "Печать" : "Подпись (факсимиле)"}</span>
                  {url ? (
                    <img src={url} alt={kind === "stamp" ? `Печать ${s.name}` : `Подпись ${s.name}`} className="h-24 w-24 rounded-lg border bg-white object-contain p-1" />
                  ) : (
                    <span className="text-sm text-muted-foreground">не загружена — в документах будет пустое место</span>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="file" name="file" accept="image/png,image/jpeg" required className="text-sm" aria-label={kind === "stamp" ? "Файл печати" : "Файл подписи"} />
                    <button type="submit" className="btn-outline h-9 px-3 text-sm">Загрузить</button>
                  </div>
                </form>
              );
            })}
          </div>
        </section>
      ))}
      <p className="text-sm text-muted-foreground">
        Печать и подпись хранятся в закрытом хранилище и встраиваются в PDF при скачивании КП и счёта. Лучше PNG с прозрачным фоном.
      </p>
    </>
  );
}

function Field({ label, name, value, required, placeholder }: { label: string; name: string; value: string | null; required?: boolean; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input name={name} defaultValue={value ?? ""} required={required} placeholder={placeholder} className="field" />
    </label>
  );
}
