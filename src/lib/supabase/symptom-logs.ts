import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { requireAuthUserForSave } from "@/lib/supabase/auth-save-guard";

export type SymptomLogRow = {
  id: string;
  recordedAt: string;
  symptomName: string;
  category: string;
};

function rowToSymptomLog(r: Record<string, unknown>): SymptomLogRow {
  return {
    id: String(r.id),
    recordedAt: String(r.recorded_at),
    symptomName: String(r.symptom_name),
    category: String(r.category),
  };
}

/**
 * Recent quick-tap rows for reports and history (newest first).
 */
export async function fetchSymptomLogsFromSupabase(
  limit = 500,
): Promise<SymptomLogRow[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("symptom_logs")
    .select("id, recorded_at, symptom_name, category")
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((x) => rowToSymptomLog(x as Record<string, unknown>));
}

/**
 * Inserts one quick-tap symptom row for the signed-in user (`symptom_logs`).
 */
export async function insertSymptomLogRow(input: {
  symptom_name: string;
  category: string;
  recorded_at?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "no_client" };

  const authUser = await requireAuthUserForSave(sb);
  if (!authUser) {
    return { ok: false, error: "not_signed_in" };
  }

  const { error } = await sb.from("symptom_logs").insert({
    user_id: authUser.id,
    symptom_name: input.symptom_name,
    category: input.category,
    recorded_at: input.recorded_at ?? new Date().toISOString(),
  });

  if (error) {
    console.warn("[symptom_logs] insert:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
