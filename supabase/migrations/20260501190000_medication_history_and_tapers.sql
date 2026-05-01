-- Append-only medication dose/time/taper changes (app merges current state locally).
create table if not exists public.medication_history (
  id uuid primary key default gen_random_uuid(),
  medication_id text not null,
  medication_name text not null,
  recorded_at timestamptz not null default now(),
  change_kind text not null check (
    change_kind in ('dose', 'time', 'dose_time', 'taper')
  ),
  old_dose_label text,
  new_dose_label text,
  old_scheduled_times text[],
  new_scheduled_times text[],
  reason text not null,
  taper_segments jsonb
);

comment on table public.medication_history is 'Audit trail for dose, schedule, and taper edits from MedicationManager.';

create index if not exists medication_history_med_idx
  on public.medication_history (medication_id, recorded_at desc);

alter table public.medication_history enable row level security;

create policy "medication_history_insert_anon"
  on public.medication_history for insert to anon with check (true);
create policy "medication_history_select_anon"
  on public.medication_history for select to anon using (true);
create policy "medication_history_insert_authenticated"
  on public.medication_history for insert to authenticated with check (true);
create policy "medication_history_select_authenticated"
  on public.medication_history for select to authenticated using (true);

create table if not exists public.taper_plans (
  id uuid primary key default gen_random_uuid(),
  medication_id text not null unique,
  medication_name text not null,
  start_date date not null,
  segments jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.taper_plans is 'Multi-step taper schedules (e.g. 60mg x7d then 30mg).';

create index if not exists taper_plans_med_idx on public.taper_plans (medication_id);

alter table public.taper_plans enable row level security;

create policy "taper_plans_insert_anon"
  on public.taper_plans for insert to anon with check (true);
create policy "taper_plans_update_anon"
  on public.taper_plans for update to anon using (true);
create policy "taper_plans_select_anon"
  on public.taper_plans for select to anon using (true);
create policy "taper_plans_insert_authenticated"
  on public.taper_plans for insert to authenticated with check (true);
create policy "taper_plans_update_authenticated"
  on public.taper_plans for update to authenticated using (true);
create policy "taper_plans_select_authenticated"
  on public.taper_plans for select to authenticated using (true);
