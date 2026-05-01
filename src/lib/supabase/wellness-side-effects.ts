import type { BrainFogEntry, MoodEntry, SideEffectLog } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export async function persistMoodToSupabase(entry: MoodEntry): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;
  const { error } = await sb.from("mood_logs").insert({
    id: entry.id,
    recorded_at: entry.recordedAt,
    mood: entry.mood,
  });
  return !error;
}

export async function persistBrainFogToSupabase(
  entry: BrainFogEntry
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;
  const { error } = await sb.from("brain_fog_logs").insert({
    id: entry.id,
    recorded_at: entry.recordedAt,
    score: entry.score,
  });
  return !error;
}

export async function persistSideEffectLogToSupabase(
  row: SideEffectLog
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;
  const { error } = await sb.from("side_effect_logs").insert({
    id: row.id,
    recorded_at: row.recordedAt,
    medication_id: row.medicationId,
    medication_name: row.medicationName,
    dose_label: row.doseLabel ?? null,
    symptoms: row.symptoms,
  });
  return !error;
}
