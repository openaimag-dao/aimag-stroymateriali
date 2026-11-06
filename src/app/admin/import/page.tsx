import { FileSpreadsheet } from "lucide-react";
import { ImportForm } from "@/components/admin/import-form";
import { COLUMNS } from "@/lib/price-import";

export default function ImportPage() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-semibold">Загрузка прайсов</h1>
        <a href="/admin/import/template" className="btn-outline">
          <FileSpreadsheet className="h-[18px] w-[18px]" aria-hidden="true" /> Скачать шаблон Excel
        </a>
      </div>
      <div className="card flex flex-col gap-2 p-5 text-[15px] leading-relaxed text-steel-700">
        <p>
          Заполните лист «Прайс» в шаблоне и загрузите файл. Сначала система проверит строки и покажет рассчитанную цену — записывает
          только после подтверждения. Повторная загрузка с тем же артикулом обновляет позицию.
        </p>
        <ul className="list-inside list-disc text-sm text-steel-500">
          <li>
            Цена: из «{COLUMNS.purchase}» × курс + логистика, с наценкой подраздела и НДС 16%. Если заполнена «{COLUMNS.price}» — берётся она
            как есть и не меняется при пересчёте по курсу.
          </li>
          <li>Валюта: KZT, RUB или CNY. Курс берётся последний из «Курс и наценки».</li>
          <li>Характеристики (толщина, цвет, диаметр…) — значения из листа «Справочник»; «0,5», «RAL 3005», «1 1/4» распознаются.</li>
          <li>«Группа» объединяет варианты в одну карточку: «Профнастил С21», «Фитинги PP-R».</li>
        </ul>
      </div>
      <ImportForm />
    </>
  );
}
