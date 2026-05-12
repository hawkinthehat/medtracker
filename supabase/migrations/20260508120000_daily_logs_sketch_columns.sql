-- Symptom body sketches stored on daily_logs (specialist export / migration tracking).
alter table public.daily_logs
  add column if not exists sketch_png_base64 text;

alter table public.daily_logs
  add column if not exists sketch_side text;

comment on column public.daily_logs.sketch_png_base64 is 'PNG image bytes as base64 (no data: prefix), optional.';
