-- Служебные функции правил доступа не нужны незалогиненным посетителям.
-- Вошедшим (authenticated) EXECUTE оставляем: без него не работают политики RLS.
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.my_company_ids() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.my_company_ids() to authenticated;
