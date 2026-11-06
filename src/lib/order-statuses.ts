/** Order statuses as shown in the admin. */
export const orderStatuses: Record<string, { label: string; cls: string }> = {
  awaiting_payment: { label: "Ждёт оплаты", cls: "bg-amber-50 text-amber-900" },
  paid: { label: "Оплачен", cls: "bg-blue-50 text-blue-800" },
  shipped: { label: "Отгружен", cls: "bg-steel-100 text-steel-700" },
  delivered: { label: "Доставлен", cls: "bg-emerald-50 text-emerald-800" },
  cancelled: { label: "Отменён", cls: "bg-steel-50 text-steel-500" },
};
