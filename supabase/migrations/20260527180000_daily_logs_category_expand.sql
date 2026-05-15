-- Expand `daily_logs.category` CHECK constraint so semantic app values (movement,
-- caffeine, sodium, medication) can be stored. The client also maps unknown values
-- to the legacy five-way set on insert; this migration keeps the DB aligned with
-- `src/lib/types.ts` DailyLogCategory when rows are written from SQL or older builds.

alter table public.daily_logs drop constraint if exists daily_logs_category_check;

alter table public.daily_logs add constraint daily_logs_category_check check (
  category in (
    'food',
    'hydration',
    'sleep',
    'activity',
    'other',
    'movement',
    'caffeine',
    'sodium',
    'medication'
  )
);
