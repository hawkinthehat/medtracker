-- Remove demo timeline rows from earlier seeds (product builds ship with an empty list).
delete from public.medications
where id like 'jade-%';
