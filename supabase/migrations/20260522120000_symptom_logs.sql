-- One-tap symptom quick logs from the home Symptom Matrix (per user, RLS).
create table if not exists public.symptom_logs (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  symptom_name text not null,
  category text not null,
  recorded_at timestamptz not null default now()
);

comment on table public.symptom_logs is 'Quick-tap symptom entries from the home Symptom Matrix.';
comment on column public.symptom_logs.category is 'Matrix bucket: dysautonomia | mcas | autoimmune_sjogrens.';
comment on column public.symptom_logs.symptom_name is 'Human-readable symptom label as shown in the UI.';

create index if not exists symptom_logs_user_recorded_idx on public.symptom_logs (user_id, recorded_at desc);

alter table public.symptom_logs enable row level security;

create policy "symptom_logs_insert_own" on public.symptom_logs for insert to authenticated
with
  check (auth.uid() = user_id);

create policy "symptom_logs_select_own" on public.symptom_logs for select to authenticated using (
  auth.uid() = user_id
);
