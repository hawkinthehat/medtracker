-- Align `daily_logs` with the app contract: semantic column is `entry_type` (water | caffeine | sodium | …).
-- Reverses 20260525100000 when `log_entry_type` exists and `entry_type` does not.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_logs'
      and column_name = 'log_entry_type'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_logs'
      and column_name = 'entry_type'
  ) then
    alter table public.daily_logs rename column log_entry_type to entry_type;
  end if;
end $$;
