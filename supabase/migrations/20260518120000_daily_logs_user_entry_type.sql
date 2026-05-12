-- Ownership + semantic tags for daily_logs (mobile auth inserts).
alter table public.daily_logs
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.daily_logs
  add column if not exists entry_type text;

-- Renamed to `log_entry_type` in 20260525100000_daily_logs_entry_type_to_log_entry_type.sql (matches app).

comment on column public.daily_logs.user_id is 'Authenticated author; null for legacy anon rows.';
comment on column public.daily_logs.entry_type is 'Semantic tag, e.g. morning_meds_completed.';

create index if not exists daily_logs_user_recorded_idx on public.daily_logs (user_id, recorded_at desc);
