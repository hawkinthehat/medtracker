-- Current dose + schedule per medication (synced from Dose & Timing modal).
create table if not exists public.medication_profiles (
  medication_id text primary key,
  dose_value numeric not null,
  dose_unit text not null check (dose_unit in ('mg', 'mcg')),
  scheduled_times text[] not null default '{}',
  updated_at timestamptz not null default now()
);

comment on table public.medication_profiles is 'Latest dose and scheduled times per medication; history remains in medication_history.';

create index if not exists medication_profiles_updated_idx
  on public.medication_profiles (updated_at desc);

alter table public.medication_profiles enable row level security;

create policy "medication_profiles_insert_anon"
  on public.medication_profiles for insert to anon with check (true);
create policy "medication_profiles_update_anon"
  on public.medication_profiles for update to anon using (true);
create policy "medication_profiles_select_anon"
  on public.medication_profiles for select to anon using (true);
create policy "medication_profiles_insert_authenticated"
  on public.medication_profiles for insert to authenticated with check (true);
create policy "medication_profiles_update_authenticated"
  on public.medication_profiles for update to authenticated using (true);
create policy "medication_profiles_select_authenticated"
  on public.medication_profiles for select to authenticated using (true);
