import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { SavedMedication } from "@/lib/seed-medications";

/**
 * Keeps `public.medications` (timeline / due windows) aligned with the user's
 * stash after edits. Works for anon + authenticated per RLS policies.
 */
export async function upsertPublicMedicationRemote(
  med: SavedMedication,
  scheduledTimes: string[],
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return true;
  const { error } = await sb.from("medications").upsert(
    {
      id: med.id,
      name: med.name,
      scheduled_times: scheduledTimes,
      dose_label: med.doseLabel ?? null,
      duration_minutes: 60,
    },
    { onConflict: "id" },
  );
  if (error) {
    console.warn("medications upsert:", error.message);
    return false;
  }
  return true;
}

export async function deletePublicMedicationRemote(
  medicationId: string,
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return true;
  const { error } = await sb
    .from("medications")
    .delete()
    .eq("id", medicationId);
  if (error) {
    console.warn("medications delete:", error.message);
    return false;
  }
  return true;
}
