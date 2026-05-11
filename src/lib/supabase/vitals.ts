import type { VitalRow } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export async function persistVitalToSupabase(row: VitalRow): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;
  const { error } = await sb.from("vitals_readings").insert({
    id: row.id,
    recorded_at: row.recordedAt,
    systolic: row.systolic,
    diastolic: row.diastolic,
    heart_rate: row.heartRate ?? null,
    notes: row.notes ?? null,
  });
  if (error) {
    console.warn("vitals_readings insert:", error.message);
    return false;
  }
  return true;
}
