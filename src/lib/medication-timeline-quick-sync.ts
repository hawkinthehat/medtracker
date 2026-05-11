import type { QueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { MedicationProfile } from "@/lib/medication-profile-types";
import type { SavedMedication } from "@/lib/seed-medications";
import { getActiveMedications } from "@/lib/medication-active";
import { timesForFrequency } from "@/lib/medication-dose-frequency-save";
import { upsertPublicMedicationRemote } from "@/lib/supabase/medications-timeline";

/**
 * Writes suggested `scheduled_times` rows to Supabase `medications` for each
 * active medication (manual “Quick sync” — never runs automatically).
 */
export async function syncPublicMedicationTimelineFromUserList(
  qc: QueryClient,
): Promise<{ ok: number; fail: number }> {
  const meds = getActiveMedications(
    qc.getQueryData<SavedMedication[]>(qk.medications) ?? [],
  );
  const profiles =
    qc.getQueryData<Record<string, MedicationProfile | undefined>>(
      qk.medicationProfiles,
    ) ?? {};

  let ok = 0;
  let fail = 0;
  for (const med of meds) {
    const p = profiles[med.id];
    const times = timesForFrequency(med.frequencyHint ?? "2x", p);
    const success = await upsertPublicMedicationRemote(med, times);
    if (success) ok += 1;
    else fail += 1;
  }
  await qc.invalidateQueries({ queryKey: qk.medicationTimeline });
  return { ok, fail };
}
