-- Structured weather samples for barometric correlation (orthostatic / MCAS research).
create table if not exists public.weather_logs (
  id uuid primary key default gen_random_uuid (),
  pressure numeric not null,
  temp numeric not null,
  humidity numeric,
  recorded_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null
);

comment on table public.weather_logs is 'OpenWeather snapshots (pressure hPa, °C, humidity %); tied to user when authenticated.';
comment on column public.weather_logs.pressure is 'Sea-level equivalent pressure, hPa.';
comment on column public.weather_logs.temp is 'Ambient temperature (°C).';
comment on column public.weather_logs.humidity is 'Relative humidity 0–100 when available.';
comment on column public.weather_logs.recorded_at is 'Observation timestamp (UTC).';

create index if not exists weather_logs_recorded_at_idx on public.weather_logs (recorded_at desc);
create index if not exists weather_logs_user_id_idx on public.weather_logs (user_id);

alter table public.weather_logs enable row level security;

create policy "weather_logs_insert_anon" on public.weather_logs for insert to anon
with
  check (true);

create policy "weather_logs_select_anon" on public.weather_logs for select to anon using (true);

create policy "weather_logs_insert_authenticated" on public.weather_logs for insert to authenticated
with
  check (true);

create policy "weather_logs_select_authenticated" on public.weather_logs for select to authenticated using (true);

-- Optional correlation line for specialists (orthostatic vs pressure).
alter table public.mood_logs
add column if not exists notes text;

alter table public.brain_fog_logs
add column if not exists notes text;

comment on column public.mood_logs.notes is 'Optional context, e.g. atmospheric pressure at log time.';
comment on column public.brain_fog_logs.notes is 'Optional context, e.g. atmospheric pressure at log time.';
