import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { QuickReliefPeriod } from "@/lib/quick-relief";

export type MedicationLogRow = {
  id: string;
  recordedAt: string;
  medicationName: string;
  dosageLabel: string;
  period: QuickReliefPeriod;
  medicationId: string | null;
  linkedBodyPartId: string | null;
  linkedPainCategory: string | null;
  linkedPainIntensity: number | null;
  linkSummary: string | null;
};

function rowToLog(r: Record<string, unknown>): MedicationLogRow {
  return {
    id: String(r.id),
    recordedAt: String(r.recorded_at),
    medicationName: String(r.medication_name),
    dosageLabel: String(r.dosage_label),
    period: r.period === "PM" ? "PM" : "AM",
    medicationId: r.medication_id == null ? null : String(r.medication_id),
    linkedBodyPartId:
      r.linked_body_part_id == null ? null : String(r.linked_body_part_id),
    linkedPainCategory:
      r.linked_pain_category == null ? null : String(r.linked_pain_category),
    linkedPainIntensity:
      r.linked_pain_intensity == null
        ? null
        : Number(r.linked_pain_intensity),
    linkSummary: r.link_summary == null ? null : String(r.link_summary),
  };
}

export async function fetchMedicationLogsFromSupabase(
  limit = 200,
): Promise<MedicationLogRow[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("medication_logs")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((x) => rowToLog(x as Record<string, unknown>));
}

export type InsertMedicationLogInput = {
  medicationName: string;
  dosageLabel: string;
  period: QuickReliefPeriod;
  medicationId?: string | null;
  linkedBodyPartId?: string | null;
  linkedPainCategory?: string | null;
  linkedPainIntensity?: number | null;
  linkSummary?: string | null;
};

export async function insertMedicationLogRow(
  input: InsertMedicationLogInput,
): Promise<{ ok: boolean; row?: MedicationLogRow; error?: string }> {
  const sb = getSupabaseBrowserClient();
  if (!sb) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const id = crypto.randomUUID();
  const recordedAt = new Date().toISOString();
  const { error } = await sb.from("medication_logs").insert({
    id,
    recorded_at: recordedAt,
    medication_name: input.medicationName,
    dosage_label: input.dosageLabel,
    period: input.period,
    medication_id: input.medicationId ?? null,
    linked_body_part_id: input.linkedBodyPartId ?? null,
    linked_pain_category: input.linkedPainCategory ?? null,
    linked_pain_intensity: input.linkedPainIntensity ?? null,
    link_summary: input.linkSummary ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  const row: MedicationLogRow = {
    id,
    recordedAt,
    medicationName: input.medicationName,
    dosageLabel: input.dosageLabel,
    period: input.period,
    medicationId: input.medicationId ?? null,
    linkedBodyPartId: input.linkedBodyPartId ?? null,
    linkedPainCategory: input.linkedPainCategory ?? null,
    linkedPainIntensity: input.linkedPainIntensity ?? null,
    linkSummary: input.linkSummary ?? null,
  };
  return { ok: true, row };
}
