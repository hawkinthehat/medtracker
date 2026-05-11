import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { QuickReliefPeriod } from "@/lib/quick-relief";
import {
  requireAuthUserForSave,
  resolveSupabaseUserId,
} from "@/lib/supabase/auth-save-guard";

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
  status: string | null;
  userId: string | null;
};

export const MORNING_ROUTINE_MEDICATION_NAME = "Morning Routine";

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
    status: r.status == null ? null : String(r.status),
    userId: r.user_id == null ? null : String(r.user_id),
  };
}

export async function fetchMedicationLogsFromSupabase(
  limit = 200,
): Promise<MedicationLogRow[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const uid = await resolveSupabaseUserId(sb);
  if (!uid) return [];

  const { data, error } = await sb
    .from("medication_logs")
    .select("*")
    .or(`user_id.eq.${uid},user_id.is.null`)
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
  status?: string | null;
};

export async function insertMedicationLogRow(
  input: InsertMedicationLogInput,
): Promise<{ ok: boolean; row?: MedicationLogRow; error?: string }> {
  const sb = getSupabaseBrowserClient();
  if (!sb) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const authUser = await requireAuthUserForSave(sb);
  if (!authUser) {
    return { ok: false, error: "not_signed_in" };
  }
  const uid = authUser.id;

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
    status: input.status ?? null,
    user_id: uid,
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
    status: input.status ?? null,
    userId: uid,
  };
  return { ok: true, row };
}

/**
 * Morning meds toggle — upsert semantics for today: update existing row or insert,
 * so repeat taps don’t duplicate and “taken” stays locked to today.
 */
export async function upsertMorningRoutineMedicationLog(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "no_client" };

  const authUser = await requireAuthUserForSave(sb);
  if (!authUser) {
    return { ok: false, error: "not_signed_in" };
  }
  const uid = authUser.id;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data: existingRows, error: existingErr } = await sb
    .from("medication_logs")
    .select("id")
    .eq("user_id", uid)
    .eq("medication_name", MORNING_ROUTINE_MEDICATION_NAME)
    .gte("recorded_at", start.toISOString())
    .lt("recorded_at", end.toISOString())
    .limit(1);

  if (existingErr) {
    console.error(
      "[medication_logs] Morning Routine lookup:",
      existingErr.message,
    );
    return { ok: false, error: existingErr.message };
  }

  const recordedAt = new Date().toISOString();
  const existingId =
    existingRows &&
    Array.isArray(existingRows) &&
    existingRows.length > 0 &&
    typeof (existingRows[0] as { id?: string }).id === "string"
      ? (existingRows[0] as { id: string }).id
      : null;

  if (existingId) {
    const { error } = await sb
      .from("medication_logs")
      .update({
        recorded_at: recordedAt,
        status: "taken",
      })
      .eq("id", existingId)
      .eq("user_id", uid);

    if (error) {
      console.error("[medication_logs] Morning Routine update failed:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const id = crypto.randomUUID();

  const { error } = await sb.from("medication_logs").insert({
    id,
    recorded_at: recordedAt,
    medication_name: MORNING_ROUTINE_MEDICATION_NAME,
    dosage_label: "—",
    period: "AM",
    medication_id: null,
    linked_body_part_id: null,
    linked_pain_category: null,
    linked_pain_intensity: null,
    link_summary: null,
    status: "taken",
    user_id: uid,
  });

  if (error) {
    console.error("[medication_logs] Morning Routine insert failed:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** @deprecated Use {@link upsertMorningRoutineMedicationLog}. */
export async function insertMorningRoutineMedicationLog(): Promise<{
  ok: boolean;
  error?: string;
}> {
  return upsertMorningRoutineMedicationLog();
}
