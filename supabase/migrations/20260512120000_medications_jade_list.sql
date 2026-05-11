-- Scheduled medications for timeline / Due checklist (browser seed mirrors these ids).
create table if not exists public.medications (
  id text primary key,
  name text not null,
  scheduled_times jsonb not null default '[]'::jsonb,
  duration_minutes int not null default 60,
  dose_label text
);

comment on table public.medications is 'Dose windows for daily timeline; React app seeds Jade list when remote empty.';

create index if not exists medications_name_idx on public.medications (name);

alter table public.medications enable row level security;

drop policy if exists "medications_insert_anon" on public.medications;
drop policy if exists "medications_select_anon" on public.medications;
drop policy if exists "medications_insert_authenticated" on public.medications;
drop policy if exists "medications_select_authenticated" on public.medications;
drop policy if exists "medications_update_anon" on public.medications;
drop policy if exists "medications_update_authenticated" on public.medications;

create policy "medications_insert_anon" on public.medications for insert to anon
with
  check (true);

create policy "medications_select_anon" on public.medications for select to anon using (true);

create policy "medications_insert_authenticated" on public.medications for insert to authenticated
with
  check (true);

create policy "medications_select_authenticated" on public.medications for select to authenticated using (true);

create policy "medications_update_anon" on public.medications for update to anon using (true)
with
  check (true);

create policy "medications_update_authenticated" on public.medications for update to authenticated using (true)
with
  check (true);

insert into
  public.medications (id, name, scheduled_times, dose_label)
values
  ('jade-gleevec', 'Gleevec', '["08:00","20:00"]'::jsonb, '100mg · 2× daily'),
  ('jade-buspirone', 'Buspirone', '["08:00","20:00"]'::jsonb, '30mg · 2× daily'),
  ('jade-pregabalin', 'Pregabalin', '["08:00","20:00"]'::jsonb, '75mg · 2× daily'),
  ('jade-estradiol', 'Estradiol', '["08:00"]'::jsonb, '2mg · 1× daily'),
  ('jade-trazodone', 'Trazodone', '["21:00"]'::jsonb, '100mg · 1× daily'),
  ('jade-magnesium', 'Magnesium', '["08:00"]'::jsonb, '1000mg · 1× daily'),
  ('jade-latuda', 'Latuda', '["19:00"]'::jsonb, '120mg · 1× daily'),
  ('jade-midodrine', 'Midodrine', '["08:00","14:00","20:00"]'::jsonb, '10mg · 3× daily'),
  ('jade-duloxetine', 'Duloxetine', '["08:00"]'::jsonb, '60mg · 1× daily'),
  (
    'jade-methylphenidate',
    'Methylphenidate',
    '["08:00","13:00","18:00"]'::jsonb,
    '10mg · 3× daily'
  ),
  ('jade-thermotabs', 'Thermotabs', '["08:00","20:00"]'::jsonb, '360mg · 2× daily'),
  ('jade-methocarbamol', 'Methocarbamol', '[]'::jsonb, '750mg · as needed'),
  ('jade-lorazepam', 'Lorazepam', '[]'::jsonb, '0.5mg · as needed'),
  ('jade-ondansetron', 'Ondansetron', '[]'::jsonb, '4mg')
on conflict (id) do update
set
  name = excluded.name,
  scheduled_times = excluded.scheduled_times,
  dose_label = excluded.dose_label;
