-- Server-side "inserted at" for full-cycle UI sync (filter today by `created_at`).
alter table public.daily_logs
  add column if not exists created_at timestamptz;

update public.daily_logs
set created_at = recorded_at
where created_at is null;

alter table public.daily_logs
  alter column created_at set default now();

alter table public.daily_logs
  alter column created_at set not null;

comment on column public.daily_logs.created_at is 'Row insert time (UTC); used with local-day bounds for today''s log sync.';
