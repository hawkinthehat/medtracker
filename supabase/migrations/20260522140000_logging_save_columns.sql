-- Structured water amount + medication log ownership / status for reliable mobile saves.
alter table public.daily_logs
  add column if not exists value double precision;

comment on column public.daily_logs.value is 'Numeric payload when log_entry_type=water (fluid ounces), caffeine/sodium mg when applicable.';

alter table public.medication_logs
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.medication_logs
  add column if not exists status text;

comment on column public.medication_logs.user_id is 'Authenticated author when row is user-scoped.';
comment on column public.medication_logs.status is 'e.g. taken — Morning Routine toggle.';

create index if not exists medication_logs_user_recorded_idx
  on public.medication_logs (user_id, recorded_at desc);
