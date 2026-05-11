-- Last interaction time on symptom map rows (for PRN ↔ flare correlation).
alter table public.pain_map add column if not exists updated_at timestamptz;

update public.pain_map
set updated_at = coalesce(created_at, now())
where updated_at is null;

alter table public.pain_map
  alter column updated_at set default now();

alter table public.pain_map
  alter column updated_at set not null;

comment on column public.pain_map.updated_at is 'Bumped on every SymptomMapper save so QuickRelief can correlate recent map touches.';

-- PRN / quick-relief doses with optional symptom-map link for specialist reports.
create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  recorded_at timestamptz not null default now(),
  medication_name text not null,
  dosage_label text not null,
  period text not null check (period in ('AM', 'PM')),
  medication_id text,
  linked_body_part_id text,
  linked_pain_category text,
  linked_pain_intensity smallint,
  link_summary text
);

comment on table public.medication_logs is 'Quick-relief PRN logs; optional pain_map correlation for doctor reports.';

create index if not exists medication_logs_recorded_at_idx
  on public.medication_logs (recorded_at desc);

create index if not exists medication_logs_name_time_idx
  on public.medication_logs (medication_name, recorded_at desc);

alter table public.medication_logs enable row level security;

create policy "medication_logs_insert_anon"
  on public.medication_logs for insert to anon with check (true);

create policy "medication_logs_select_anon"
  on public.medication_logs for select to anon using (true);

create policy "medication_logs_insert_authenticated"
  on public.medication_logs for insert to authenticated with check (true);

create policy "medication_logs_select_authenticated"
  on public.medication_logs for select to authenticated using (true);
