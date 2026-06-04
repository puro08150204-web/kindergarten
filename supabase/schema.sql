create extension if not exists pgcrypto;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  status text not null default '在架上',
  book_code text not null unique,
  stage text,
  title text not null,
  publisher text,
  published_date date,
  author text,
  translator text,
  keywords text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.borrowers (
  id uuid primary key default gen_random_uuid(),
  borrower_last_name text not null,
  borrower_line_id text not null unique,
  child_class text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  borrower_id uuid not null references public.borrowers(id) on delete cascade,
  borrowed_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '30 days'),
  returned_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists books_search_idx on public.books using gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(book_code, '') || ' ' || coalesce(stage, '') || ' ' || coalesce(keywords, ''))
);
create index if not exists loans_active_idx on public.loans (borrower_id, returned_at);
create index if not exists loans_due_idx on public.loans (due_at) where returned_at is null;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
before update on public.books
for each row execute function public.set_updated_at();

drop trigger if exists borrowers_set_updated_at on public.borrowers;
create trigger borrowers_set_updated_at
before update on public.borrowers
for each row execute function public.set_updated_at();

alter table public.books enable row level security;
alter table public.borrowers enable row level security;
alter table public.loans enable row level security;

grant select, insert, update, delete on public.books to service_role;
grant select, insert, update, delete on public.borrowers to service_role;
grant select, insert, update, delete on public.loans to service_role;
grant select on public.books to anon;

create policy "Public can read books"
on public.books for select
to anon
using (true);

-- Writes are performed by Next.js API routes with SUPABASE_SERVICE_ROLE_KEY.
