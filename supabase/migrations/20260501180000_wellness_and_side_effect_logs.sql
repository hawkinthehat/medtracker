-- Mood check-ins (planner MoodTracker pulse UI).
create table if not exists public.mood_logs (
  id uuid primary key,
  recorded_at timestamptz not null,
  mood smallint not null check (mood between 1 and 5)
);

comment on table public.mood_logs is 'Quick mood scores from planner (1=crisis … 5=great).';

create index if not exists mood_logs_recorded_at_idx on public.mood_logs (recorded_at desc);

-- Brain fog quick logs (5 UI levels stored as 2,4,6,8,10).
create table if not exists public.brain_fog_logs (
  id uuid primary key,
  recorded_at timestamptz not null,
  score smallint not null check (score between 1 and 10)
);

comment on table public.brain_fog_logs is 'Brain fog severity (1 clearest … 10 worst).';

create index if not exists brain_fog_logs_recorded_at_idx on public.brain_fog_logs (recorded_at desc);

-- Side-effect tolerability rows (also synced from React Query cache).
create table if not exists public.side_effect_logs (
  id uuid primary key,
  recorded_at timestamptz not null,
  medication_id text not null,
  medication_name text not null,
  dose_label text,
  symptoms text[] not null default '{}'
);

comment on table public.side_effect_logs is 'Post-dose symptoms linked to a medication for tolerability reporting.';

create index if not exists side_effect_logs_recorded_at_idx on public.side_effect_logs (recorded_at desc);

alter table public.mood_logs enable row level security;
alter table public.brain_fog_logs enable row level security;
alter table public.side_effect_logs enable row level security;

create policy "mood_logs_insert_anon" on public.mood_logs for insert to anon with check (true);
create policy "mood_logs_select_anon" on public.mood_logs for select to anon using (true);
create policy "mood_logs_insert_authenticated" on public.mood_logs for insert to authenticated with check (true);
create policy "mood_logs_select_authenticated" on public.mood_logs for select to authenticated using (true);

create policy "brain_fog_logs_insert_anon" on public.brain_fog_logs for insert to anon with check (true);
create policy "brain_fog_logs_select_anon" on public.brain_fog_logs for select to anon using (true);
create policy "brain_fog_logs_insert_authenticated" on public.brain_fog_logs for insert to authenticated with check (true);
create policy "brain_fog_logs_select_authenticated" on public.brain_fog_logs for select to authenticated using (true);

create policy "side_effect_logs_insert_anon" on public.side_effect_logs for insert to anon with check (true);
create policy "side_effect_logs_select_anon" on public.side_effect_logs for select to anon using (true);
create policy "side_effect_logs_insert_authenticated" on public.side_effect_logs for insert to authenticated with check (true);
create policy "side_effect_logs_select_authenticated" on public.side_effect_logs for select to authenticated using (true);
