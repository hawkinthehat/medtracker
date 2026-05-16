-- Rename optional HR column to `pulse` (Quick BP + app use this name).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where
      table_schema = 'public'
      and table_name = 'health_vitals'
      and column_name = 'heart_rate'
  ) then
    alter table public.health_vitals rename column heart_rate to pulse;
  end if;
end$$;

comment on column public.health_vitals.pulse is 'Heart rate (bpm), optional.';
