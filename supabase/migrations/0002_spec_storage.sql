-- Хранилище файлов спецификаций: specs/<company_id>/<файл>.
-- Покупатель загружает и видит только файлы своей компании, персонал — все.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'specs', 'specs', false, 20971520,
  array[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/heic', 'text/csv'
  ]
)
on conflict (id) do nothing;

create policy specs_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'specs'
    and (storage.foldername(name))[1]::uuid in (select my_company_ids())
  );

create policy specs_files_read on storage.objects for select to authenticated
  using (
    bucket_id = 'specs'
    and ((storage.foldername(name))[1]::uuid in (select my_company_ids()) or is_staff())
  );
