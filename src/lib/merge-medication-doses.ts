import {
  DEFAULT_DOSE_DURATION_MIN,
  fetchScheduledDosesFromSupabase,
  normalizeMedName,
  type ScheduledDose,
} from "@/lib/medication-schedule";
import type { MedicationProfile } from "@/lib/medication-profile-types";
import type { SavedMedication } from "@/lib/seed-medications";
import type { QueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { getActiveMedications } from "@/lib/medication-active";

function parseTimeToMinutes(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (
    Number.isNaN(h) ||
    Number.isNaN(min) ||
    h > 23 ||
    min > 59 ||
    h < 0 ||
    min < 0
  )
    return null;
  return h * 60 + min;
}

/**
 * Replace or add dose rows using `scheduledTimes` from profiles (by medication id).
 */
export function mergeProfilesIntoDoses(
  base: ScheduledDose[],
  medications: SavedMedication[],
  profiles: Record<string, MedicationProfile | undefined>
): ScheduledDose[] {
  let working = [...base];

  for (const med of medications) {
    const p = profiles[med.id];
    const times = p?.scheduledTimes?.filter(Boolean);
    if (!times?.length) continue;

    working = working.filter(
      (d) => normalizeMedName(d.medicationName) !== normalizeMedName(med.name)
    );

    times.forEach((raw, idx) => {
      const mins = parseTimeToMinutes(raw);
      if (mins == null) return;
      working.push({
        id: `profile-${med.id}-${idx}-${mins}`,
        medicationName: med.name,
        startMinute: mins,
        durationMinutes: DEFAULT_DOSE_DURATION_MIN,
      });
    });
  }

  return working;
}

export async function fetchMergedMedicationDoses(
  qc: QueryClient
): Promise<ScheduledDose[]> {
  const meds = getActiveMedications(
    qc.getQueryData<SavedMedication[]>(qk.medications) ?? [],
  );
  const profiles =
    qc.getQueryData<Record<string, MedicationProfile>>(qk.medicationProfiles) ??
    {};

  const remote = await fetchScheduledDosesFromSupabase();
  /** Timeline dose windows come from Supabase `medications` only — no bundled seed. */
  const base = remote.length > 0 ? remote : [];
  return mergeProfilesIntoDoses(base, meds, profiles);
}
