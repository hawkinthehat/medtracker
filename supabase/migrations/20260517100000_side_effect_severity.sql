alter table public.side_effect_logs
add column if not exists severity smallint;

comment on column public.side_effect_logs.severity is 'Self-reported intensity 1–10 after a dose (optional).';
