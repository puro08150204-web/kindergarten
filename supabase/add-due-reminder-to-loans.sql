alter table public.loans
add column if not exists due_reminder_sent_at timestamptz;

grant select, insert, update, delete on public.loans to service_role;
