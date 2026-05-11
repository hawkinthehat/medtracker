-- Structured activity events (e.g. dog walks) with explicit user ownership for RLS.
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_type text not null,
  notes text,
  recorded_at timestamptz not null default now()
);

comment on table public.activity_logs is 'User-scoped activity events (movement, routines).';
comment on column public.activity_logs.activity_type is 'Short machine-readable code, e.g. dog_walk.';

create index if not exists activity_logs_user_recorded_idx on public.activity_logs (user_id, recorded_at desc);

alter table public.activity_logs enable row level security;

create policy "activity_logs_insert_own" on public.activity_logs for insert to authenticated
with
  check (auth.uid() = user_id);

create policy "activity_logs_select_own" on public.activity_logs for select to authenticated using (
  auth.uid() = user_id
);
