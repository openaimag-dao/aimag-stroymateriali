/** «ТОО «Ромашка»» — название с формой собственности, как в документах. */
export function companyTitle(c: { name: string; legal_form: string | null }) {
  return c.legal_form && c.legal_form !== "Другое" ? `${c.legal_form} «${c.name}»` : c.name;
}
