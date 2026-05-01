import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type {
  PainMapSymptomCategory,
  SymptomBodyPartId,
} from "@/lib/symptom-map";

export type PainMapRow = {
  id: string;
  body_part_id: SymptomBodyPartId;
  category: PainMapSymptomCategory;
  intensity?: number | null;
  created_at?: string;
};

/** Body regions that have at least one row in `pain_map` (for SVG hints). */
export async function fetchPainMapActiveBodyPartIds(): Promise<string[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("pain_map")
    .select("body_part_id");
  if (error) {
    console.warn("pain_map active parts:", error.message);
    return [];
  }
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = (row as { body_part_id?: string }).body_part_id;
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

export async function fetchPainMapForBodyPart(
  bodyPartId: SymptomBodyPartId,
): Promise<PainMapRow[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("pain_map")
    .select("id,body_part_id,category,intensity,created_at")
    .eq("body_part_id", bodyPartId);
  if (error) {
    console.warn("pain_map select:", error.message);
    return [];
  }
  return (data ?? []) as PainMapRow[];
}

export async function upsertPainMapRow(
  bodyPartId: SymptomBodyPartId,
  category: PainMapSymptomCategory,
  intensity?: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const payload: Record<string, unknown> = {
    body_part_id: bodyPartId,
    category,
  };
  if (intensity !== undefined) {
    payload.intensity = intensity;
  }
  const { error } = await supabase.from("pain_map").upsert(payload, {
    onConflict: "body_part_id,category",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Toggle-only upsert without intensity (legacy toggles). */
export async function insertPainMapRow(
  bodyPartId: SymptomBodyPartId,
  category: PainMapSymptomCategory,
): Promise<{ ok: boolean; error?: string }> {
  return upsertPainMapRow(bodyPartId, category);
}

export async function deletePainMapRow(
  bodyPartId: SymptomBodyPartId,
  category: PainMapSymptomCategory,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const { error } = await supabase
    .from("pain_map")
    .delete()
    .eq("body_part_id", bodyPartId)
    .eq("category", category);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
