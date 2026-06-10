create table if not exists public.book_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.book_categories (name)
values ('幼兒階段'), ('國小階段'), ('國高中階段')
on conflict (name) do nothing;

alter table public.book_categories enable row level security;

grant select, insert, update, delete on public.book_categories to service_role;
