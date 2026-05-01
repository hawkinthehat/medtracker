import type {
  MedicationHistoryEntry,
  MedicationProfile,
  TaperPlan,
  TaperSegment,
} from "@/lib/medication-profile-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

function rowToEntry(row: Record<string, unknown>): MedicationHistoryEntry {
  return {
    id: String(row.id),
    medicationId: String(row.medication_id),
    medicationName: String(row.medication_name),
    recordedAt: String(row.recorded_at),
    changeKind: row.change_kind as MedicationHistoryEntry["changeKind"],
    oldDoseLabel:
      row.old_dose_label == null ? null : String(row.old_dose_label),
    newDoseLabel:
      row.new_dose_label == null ? null : String(row.new_dose_label),
    oldScheduledTimes: Array.isArray(row.old_scheduled_times)
      ? (row.old_scheduled_times as string[])
      : null,
    newScheduledTimes: Array.isArray(row.new_scheduled_times)
      ? (row.new_scheduled_times as string[])
      : null,
    reason: String(row.reason),
    taperSegments: Array.isArray(row.taper_segments)
      ? (row.taper_segments as { doseMg: number; days: number }[])
      : null,
  };
}

export async function insertMedicationHistoryRow(
  entry: Omit<MedicationHistoryEntry, "id"> & { id?: string }
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;
  const id = entry.id ?? crypto.randomUUID();
  const { error } = await sb.from("medication_history").insert({
    id,
    medication_id: entry.medicationId,
    medication_name: entry.medicationName,
    recorded_at: entry.recordedAt,
    change_kind: entry.changeKind,
    old_dose_label: entry.oldDoseLabel,
    new_dose_label: entry.newDoseLabel,
    old_scheduled_times: entry.oldScheduledTimes,
    new_scheduled_times: entry.newScheduledTimes,
    reason: entry.reason,
    taper_segments: entry.taperSegments ?? null,
  });
  return !error;
}

export async function fetchMedicationHistoryFromSupabase(): Promise<
  MedicationHistoryEntry[]
> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("medication_history")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return data.map((r) => rowToEntry(r as Record<string, unknown>));
}

export async function upsertTaperPlanRemote(plan: TaperPlan): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;
  const segments: TaperSegment[] = plan.segments.map((s) => ({
    doseMg: s.doseMg,
    days: s.days,
  }));
  const { error } = await sb.from("taper_plans").upsert(
    {
      medication_id: plan.medicationId,
      medication_name: plan.medicationName,
      start_date: plan.startDateKey,
      segments,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "medication_id" }
  );
  return !error;
}

export async function fetchTaperPlansFromSupabase(): Promise<TaperPlan[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb.from("taper_plans").select("*");
  if (error || !data?.length) return [];
  return data.map((row) => {
    const r = row as Record<string, unknown>;
    const raw = r.segments as { dose_mg?: number; doseMg?: number; days?: number }[];
    const segments: TaperSegment[] = Array.isArray(raw)
      ? raw.map((x) => ({
          doseMg: Number(x.doseMg ?? x.dose_mg ?? 0),
          days: Number(x.days ?? 0),
        }))
      : [];
    return {
      medicationId: String(r.medication_id),
      medicationName: String(r.medication_name),
      startDateKey: String(r.start_date).slice(0, 10),
      segments,
    };
  });
}

export async function loadTaperPlansMap(): Promise<Record<string, TaperPlan>> {
  const list = await fetchTaperPlansFromSupabase();
  return Object.fromEntries(list.map((p) => [p.medicationId, p]));
}

export async function fetchMedicationProfilesFromSupabase(): Promise<
  Record<string, MedicationProfile>
> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return {};
  const { data, error } = await sb.from("medication_profiles").select("*");
  if (error || !data?.length) return {};
  const out: Record<string, MedicationProfile> = {};
  for (const row of data) {
    const r = row as Record<string, unknown>;
    const id = String(r.medication_id);
    const unit = r.dose_unit === "mcg" ? "mcg" : "mg";
    const doseVal = Number(r.dose_value);
    const times = Array.isArray(r.scheduled_times)
      ? (r.scheduled_times as string[])
      : [];
    if (!Number.isFinite(doseVal)) continue;
    out[id] = {
      doseValue: doseVal,
      doseUnit: unit,
      scheduledTimes: times.length ? times : ["20:00"],
    };
  }
  return out;
}

export async function upsertMedicationProfileRemote(
  medicationId: string,
  profile: MedicationProfile
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;
  const { error } = await sb.from("medication_profiles").upsert(
    {
      medication_id: medicationId,
      dose_value: profile.doseValue,
      dose_unit: profile.doseUnit,
      scheduled_times: profile.scheduledTimes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "medication_id" }
  );
  return !error;
}
