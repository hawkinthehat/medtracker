-- Symptom map rows from the journal body SVG (SymptomMap).
-- category values match src/lib/symptom-map.ts (PainMapSymptomCategory).

create table if not exists public.pain_map (
  id uuid primary key default gen_random_uuid(),
  body_part_id text not null,
  category text not null,
  created_at timestamptz not null default now()
);

comment on table public.pain_map is 'Body-region symptom toggles from SymptomMap; category is the symptom key (e.g. burning, tingling).';

create unique index if not exists pain_map_body_part_category_unique
  on public.pain_map (body_part_id, category);

create index if not exists pain_map_body_part_id_idx
  on public.pain_map (body_part_id);

alter table public.pain_map enable row level security;

-- Adjust policies when you add Supabase Auth (scope by auth.uid()).
create policy "pain_map_insert_anon"
  on public.pain_map for insert
  to anon
  with check (true);

create policy "pain_map_select_anon"
  on public.pain_map for select
  to anon
  using (true);

create policy "pain_map_delete_anon"
  on public.pain_map for delete
  to anon
  using (true);

create policy "pain_map_insert_authenticated"
  on public.pain_map for insert
  to authenticated
  with check (true);

create policy "pain_map_select_authenticated"
  on public.pain_map for select
  to authenticated
  using (true);

create policy "pain_map_delete_authenticated"
  on public.pain_map for delete
  to authenticated
  using (true);
