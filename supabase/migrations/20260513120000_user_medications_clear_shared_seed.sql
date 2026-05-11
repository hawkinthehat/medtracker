-- User-scoped medication stash (requires Supabase Auth). Browser-only users keep using localStorage.
create table if not exists public.user_medications (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists user_medications_user_idx on public.user_medications (user_id);

alter table public.user_medications enable row level security;

drop policy if exists "user_medications_select_own" on public.user_medications;
drop policy if exists "user_medications_insert_own" on public.user_medications;
drop policy if exists "user_medications_update_own" on public.user_medications;
drop policy if exists "user_medications_delete_own" on public.user_medications;

create policy "user_medications_select_own" on public.user_medications for select to authenticated using (auth.uid() = user_id);

create policy "user_medications_insert_own" on public.user_medications for insert to authenticated with check (auth.uid() = user_id);

create policy "user_medications_update_own" on public.user_medications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_medications_delete_own" on public.user_medications for delete to authenticated using (auth.uid() = user_id);

comment on table public.user_medications is 'Tiaki SavedMedication JSON per authenticated user; anon installs use device localStorage only.';

-- Remove shared demo rows from global medications timeline (public/shared installs).
delete from public.medications;
