-- App + inserts use `log_entry_type`. Rename legacy `entry_type` when present.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_logs'
      and column_name = 'entry_type'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_logs'
      and column_name = 'log_entry_type'
  ) then
    alter table public.daily_logs rename column entry_type to log_entry_type;
  end if;
end $$;
