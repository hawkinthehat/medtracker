-- Home BP / spot readings (synced from Morning Routine and Vitals page).
create table if not exists public.vitals_readings (
  id uuid primary key,
  recorded_at timestamptz not null,
  systolic smallint not null,
  diastolic smallint not null,
  heart_rate smallint,
  notes text
);

comment on table public.vitals_readings is 'Blood pressure spot checks (mmHg).';

create index if not exists vitals_readings_recorded_at_idx
  on public.vitals_readings (recorded_at desc);

alter table public.vitals_readings enable row level security;

create policy "vitals_readings_insert_anon"
  on public.vitals_readings for insert to anon with check (true);

create policy "vitals_readings_select_anon"
  on public.vitals_readings for select to anon using (true);

create policy "vitals_readings_insert_authenticated"
  on public.vitals_readings for insert to authenticated with check (true);

create policy "vitals_readings_select_authenticated"
  on public.vitals_readings for select to authenticated using (true);
