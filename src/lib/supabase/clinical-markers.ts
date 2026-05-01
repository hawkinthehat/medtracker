import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export type ClinicalMarkersRow = {
  date_key: string;
  eye_drop_uses: number;
  oral_rinses: number;
  difficulty_swallowing_dry_food: boolean;
};

export async function fetchClinicalMarkersForDate(
  dateKey: string
): Promise<ClinicalMarkersRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("clinical_markers")
    .select(
      "date_key, eye_drop_uses, oral_rinses, difficulty_swallowing_dry_food"
    )
    .eq("date_key", dateKey)
    .maybeSingle();
  if (error || !data) return null;
  return data as ClinicalMarkersRow;
}

export async function upsertClinicalMarkers(
  row: ClinicalMarkersRow
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseBrowserClient();
  if (!sb) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const { error } = await sb.from("clinical_markers").upsert(
    {
      date_key: row.date_key,
      eye_drop_uses: row.eye_drop_uses,
      oral_rinses: row.oral_rinses,
      difficulty_swallowing_dry_food: row.difficulty_swallowing_dry_food,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "date_key" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
