"use client";

import { useFormState, useFormStatus } from "react-dom";
import { acceptInvite, inviteMember, removeMember, revokeInvite, type TeamState } from "@/app/account/team-actions";

export const roleLabels: Record<string, string> = { owner: "Владелец", buyer: "Закупщик", accountant: "Бухгалтер" };

function Submit({ children, pending: pendingText, className }: { children: string; pending: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

function Message({ state }: { state: TeamState }) {
  if (!state?.ok && !state?.error) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${state.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>
      {state.error ?? state.ok}
    </p>
  );
}

export function InviteForm() {
  const [state, action] = useFormState<TeamState, FormData>(inviteMember, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1.5 text-sm font-medium">
          Email сотрудника
          <input name="email" type="email" required className="field" placeholder="name@company.kz" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Роль
          <select name="role" className="field w-44" defaultValue="buyer">
            <option value="buyer">Закупщик</option>
            <option value="accountant">Бухгалтер</option>
          </select>
        </label>
        <Submit className="btn-dark h-[46px]" pending="Отправляем…">Пригласить</Submit>
      </div>
      <Message state={state} />
    </form>
  );
}

export function RemoveMemberButton({ userId, name }: { userId: string; name: string }) {
  return (
    <form
      action={removeMember.bind(null, userId)}
      onSubmit={(e) => {
        if (!confirm(`Убрать ${name} из кабинета компании? Доступ к ценам и документам пропадёт.`)) e.preventDefault();
      }}
    >
      <button type="submit" className="text-sm text-red-700 underline-offset-4 hover:underline">Убрать</button>
    </form>
  );
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  return (
    <form action={revokeInvite.bind(null, inviteId)}>
      <button type="submit" className="text-sm text-steel-500 underline-offset-4 hover:underline">Отозвать</button>
    </form>
  );
}

export function AcceptInviteCard(props: { inviteId: string; companyTitle: string; bin: string; role: string }) {
  const [state, action] = useFormState<TeamState, FormData>(acceptInvite.bind(null, props.inviteId), undefined);
  return (
    <form action={action} className="card flex flex-col gap-4 border-signal p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[22px] font-semibold">Вас пригласили в кабинет {props.companyTitle}</h2>
        <p className="text-sm text-steel-500">
          БИН {props.bin} · роль: {roleLabels[props.role]?.toLowerCase() ?? props.role}. После присоединения вам будут доступны оптовые
          цены, корзина, КП и счета компании.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Ваше имя
          <input name="fullName" autoComplete="name" required className="field" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Телефон
          <input name="phone" type="tel" autoComplete="tel" placeholder="+7" required className="field" />
        </label>
      </div>
      <Message state={state?.error ? state : undefined} />
      <div>
        <Submit className="btn-signal h-12" pending="Присоединяем…">Присоединиться</Submit>
      </div>
    </form>
  );
}
