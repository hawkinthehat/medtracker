-- Intensity (1–10) per body region + symptom category; upserts require UPDATE policies.

alter table public.pain_map
  add column if not exists intensity smallint;

alter table public.pain_map
  drop constraint if exists pain_map_intensity_check;

alter table public.pain_map
  add constraint pain_map_intensity_check
  check (intensity is null or (intensity >= 1 and intensity <= 10));

comment on column public.pain_map.intensity is 'Symptom intensity 1–10 from SymptomMapper drawer.';

create policy "pain_map_update_anon"
  on public.pain_map for update
  to anon
  using (true)
  with check (true);

create policy "pain_map_update_authenticated"
  on public.pain_map for update
  to authenticated
  using (true)
  with check (true);
