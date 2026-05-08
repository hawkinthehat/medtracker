-- Daily activity / intake logs (hydration glasses, food, etc.)
create table if not exists public.daily_logs (
  id uuid primary key,
  recorded_at timestamptz not null,
  category text not null
    check (category in ('food', 'hydration', 'sleep', 'activity', 'other')),
  label text not null,
  notes text
);

comment on table public.daily_logs is 'Food, hydration, sleep, activity — merged with journal on Daily Summary.';

create index if not exists daily_logs_recorded_at_idx on public.daily_logs (recorded_at desc);

alter table public.daily_logs enable row level security;

create policy "daily_logs_insert_anon" on public.daily_logs for insert to anon with check (true);
create policy "daily_logs_select_anon" on public.daily_logs for select to anon using (true);
create policy "daily_logs_insert_authenticated" on public.daily_logs for insert to authenticated with check (true);
create policy "daily_logs_select_authenticated" on public.daily_logs for select to authenticated using (true);

-- Freehand symptom drawings over body silhouette (journal).
create table if not exists public.symptom_sketches (
  id uuid primary key,
  recorded_at timestamptz not null,
  side text not null check (side in ('front', 'back')),
  brush_preset text not null
    check (brush_preset in ('burning', 'aching', 'rash')),
  image_base64 text not null
);

comment on table public.symptom_sketches is 'PNG data URL or raw base64 sketch over front/back silhouette.';

create index if not exists symptom_sketches_recorded_at_idx on public.symptom_sketches (recorded_at desc);

alter table public.symptom_sketches enable row level security;

create policy "symptom_sketches_insert_anon" on public.symptom_sketches for insert to anon with check (true);
create policy "symptom_sketches_select_anon" on public.symptom_sketches for select to anon using (true);
create policy "symptom_sketches_insert_authenticated" on public.symptom_sketches for insert to authenticated with check (true);
create policy "symptom_sketches_select_authenticated" on public.symptom_sketches for select to authenticated using (true);
