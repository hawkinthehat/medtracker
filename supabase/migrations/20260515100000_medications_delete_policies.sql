-- Allow removing timeline rows when a medication is deleted from the stash.
drop policy if exists "medications_delete_anon" on public.medications;
drop policy if exists "medications_delete_authenticated" on public.medications;

create policy "medications_delete_anon" on public.medications for delete to anon using (true);

create policy "medications_delete_authenticated" on public.medications for delete to authenticated using (true);
