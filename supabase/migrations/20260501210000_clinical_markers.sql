-- Daily Sjögren / sicca markers (planner home card).

create table if not exists public.clinical_markers (
  id uuid primary key default gen_random_uuid(),
  date_key text not null,
  eye_drop_uses integer not null default 0 check (eye_drop_uses >= 0),
  oral_rinses integer not null default 0 check (oral_rinses >= 0),
  difficulty_swallowing_dry_food boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint clinical_markers_date_key_format_chk
    check (date_key ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint clinical_markers_date_key_unique unique (date_key)
);

comment on table public.clinical_markers is 'Per-calendar-day clinical quick markers (e.g. Sjögren sicca tracking).';

create index if not exists clinical_markers_date_key_idx
  on public.clinical_markers (date_key desc);

alter table public.clinical_markers enable row level security;

create policy "clinical_markers_insert_anon"
  on public.clinical_markers for insert
  to anon
  with check (true);

create policy "clinical_markers_select_anon"
  on public.clinical_markers for select
  to anon
  using (true);

create policy "clinical_markers_update_anon"
  on public.clinical_markers for update
  to anon
  using (true)
  with check (true);

create policy "clinical_markers_insert_authenticated"
  on public.clinical_markers for insert
  to authenticated
  with check (true);

create policy "clinical_markers_select_authenticated"
  on public.clinical_markers for select
  to authenticated
  using (true);

create policy "clinical_markers_update_authenticated"
  on public.clinical_markers for update
  to authenticated
  using (true)
  with check (true);
