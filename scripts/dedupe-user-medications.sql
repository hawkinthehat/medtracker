-- One-time cleanup: remove duplicate user_medications rows with the same medication
-- name (case-insensitive) per user, keeping the row with the latest updated_at.
-- Run in Supabase SQL editor as an authenticated admin / service role when needed.
--
-- Review counts before delete:
--   select user_id, lower(trim(payload->>'name')) as n, count(*)
--   from public.user_medications group by 1, 2 having count(*) > 1;

delete from public.user_medications um
where ctid in (
  select um2.ctid
  from public.user_medications um2
  inner join (
    select
      user_id,
      lower(trim(payload->>'name')) as norm,
      max(updated_at) as keep_at
    from public.user_medications
    group by user_id, lower(trim(payload->>'name'))
    having count(*) > 1
  ) d
    on um2.user_id = d.user_id
    and lower(trim(um2.payload->>'name')) = d.norm
    and um2.updated_at < d.keep_at
);
