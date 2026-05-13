-- Quick BP and other user-scoped vitals (position-aware spot checks).
create table if not exists public.health_vitals (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  systolic smallint not null,
  diastolic smallint not null,
  position text not null,
  heart_rate smallint
);

comment on table public.health_vitals is 'Blood pressure spot checks with posture (mmHg); optional pulse.';
comment on column public.health_vitals.position is 'lying | sitting | standing';

create index if not exists health_vitals_user_recorded_idx
  on public.health_vitals (user_id, recorded_at desc);

alter table public.health_vitals enable row level security;

create policy "health_vitals_insert_own" on public.health_vitals for insert to authenticated
with
  check (auth.uid() = user_id);

create policy "health_vitals_select_own" on public.health_vitals for select to authenticated using (
  auth.uid() = user_id
);
