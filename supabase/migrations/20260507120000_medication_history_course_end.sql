-- Allow recording completion of temporary medication courses in the audit trail.
alter table public.medication_history drop constraint if exists medication_history_change_kind_check;

alter table public.medication_history add constraint medication_history_change_kind_check check (
  change_kind in ('dose', 'time', 'dose_time', 'taper', 'course_end')
);
