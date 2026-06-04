alter table public.books
add column if not exists stage text;

drop index if exists books_search_idx;
create index if not exists books_search_idx on public.books using gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(book_code, '') || ' ' || coalesce(stage, '') || ' ' || coalesce(keywords, ''))
);

grant select, insert, update, delete on public.books to service_role;
