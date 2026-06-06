alter table public.books
add column if not exists cover_image_url text;

grant select, insert, update, delete on public.books to service_role;
grant select on public.books to anon;
