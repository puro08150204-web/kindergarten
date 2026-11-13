create table if not exists public.book_reservations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  email text not null,
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'cancelled')),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create unique index if not exists book_reservations_waiting_unique
on public.book_reservations (book_id, lower(email))
where status = 'waiting';

create index if not exists book_reservations_queue_idx
on public.book_reservations (book_id, status, created_at);

alter table public.book_reservations enable row level security;
grant select, insert, update, delete on public.book_reservations to service_role;

-- All reservation access is performed by Next.js API routes with SUPABASE_SERVICE_ROLE_KEY.
