import type { DailyLogEntry } from "@/lib/types";
import {
  ENTRY_TYPE_WATER,
  ENTRY_TYPE_CAFFEINE,
  ENTRY_TYPE_ACTIVITY,
  resolveDailyLogEntryType,
} from "@/lib/daily-log-entry-type";
import {
  requireAuthUserForSave,
  resolveSupabaseUserId,
} from "@/lib/supabase/auth-save-guard";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { DOG_WALK_MARKER } from "@/lib/movement-tracking";

type DailyLogRow = {
  id: string;
  recorded_at: string;
  category: DailyLogEntry["category"];
  label: string;
  notes: string | null;
  sketch_png_base64?: string | null;
  sketch_side?: string | null;
  sketch_brush_preset?: string | null;
  user_id?: string | null;
  entry_type?: string | null;
  value?: number | null;
};

function rowToEntry(row: DailyLogRow): DailyLogEntry {
  const side = row.sketch_side;
  const brush = row.sketch_brush_preset;
  const v =
    row.value != null && Number.isFinite(Number(row.value))
      ? Number(row.value)
      : undefined;
  const et = row.entry_type ?? undefined;
  const base: DailyLogEntry = {
    id: row.id,
    recordedAt: row.recorded_at,
    category: row.category,
    label: row.label,
    notes: row.notes ?? undefined,
    sketchPngBase64: row.sketch_png_base64 ?? undefined,
    sketchSide:
      side === "front" || side === "back" ? side : undefined,
    sketchBrushPreset: brush ?? undefined,
    userId: row.user_id ?? undefined,
    entryType: et,
  };
  if (
    et === ENTRY_TYPE_CAFFEINE ||
    et === "caffeine" ||
    row.category === "caffeine"
  ) {
    return v != null && Number.isFinite(v) && v > 0
      ? { ...base, valueMg: Math.round(v) }
      : base;
  }
  return v != null && Number.isFinite(v) && v > 0
    ? { ...base, valueOz: Math.round(v) }
    : base;
}

export async function fetchDailyLogsFromSupabase(): Promise<DailyLogEntry[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("daily_logs")
    .select(
      "id,recorded_at,category,label,notes,sketch_png_base64,sketch_side,sketch_brush_preset,user_id,entry_type,value",
    )
    .order("recorded_at", { ascending: false })
    .limit(800);
  if (error) {
    console.warn("daily_logs fetch:", error.message);
    return [];
  }
  return ((data ?? []) as DailyLogRow[]).map(rowToEntry);
}

/**
 * Sum of `daily_logs.value` for today's rows with `entry_type = 'water'`.
 * Falls back to parsing `notes` when `value` is null (legacy rows).
 */
export async function fetchTodayWaterValueSumForCurrentUser(): Promise<{
  oz: number;
  hasSession: boolean;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { oz: 0, hasSession: false };

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) return { oz: 0, hasSession: false };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data, error } = await sb
    .from("daily_logs")
    .select("value,notes")
    .eq("user_id", uid)
    .eq("entry_type", ENTRY_TYPE_WATER)
    .gte("recorded_at", start.toISOString())
    .lt("recorded_at", end.toISOString());

  if (error) {
    console.warn("today water value sum fetch:", error.message);
    return { oz: 0, hasSession: true };
  }

  let oz = 0;
  for (const raw of data ?? []) {
    const row = raw as { value?: number | null; notes?: string | null };
    const fromVal =
      row.value != null && Number.isFinite(Number(row.value))
        ? Number(row.value)
        : Number.parseInt(String(row.notes ?? "").trim(), 10);
    if (Number.isFinite(fromVal) && fromVal > 0) oz += fromVal;
  }

  return { oz, hasSession: true };
}

/** Sum of `daily_logs.value` for today where `entry_type` is caffeine (mg). */
export async function fetchTodayCaffeineMgSumForCurrentUser(): Promise<{
  mg: number;
  hasSession: boolean;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { mg: 0, hasSession: false };

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) return { mg: 0, hasSession: false };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data, error } = await sb
    .from("daily_logs")
    .select("value,notes")
    .eq("user_id", uid)
    .eq("entry_type", ENTRY_TYPE_CAFFEINE)
    .gte("recorded_at", start.toISOString())
    .lt("recorded_at", end.toISOString());

  if (error) {
    console.warn("today caffeine sum fetch:", error.message);
    return { mg: 0, hasSession: true };
  }

  let mg = 0;
  for (const raw of data ?? []) {
    const row = raw as { value?: number | null; notes?: string | null };
    const fromVal =
      row.value != null && Number.isFinite(Number(row.value))
        ? Number(row.value)
        : Number.parseInt(String(row.notes ?? "").trim(), 10);
    if (Number.isFinite(fromVal) && fromVal > 0) mg += fromVal;
  }

  return { mg, hasSession: true };
}

/**
 * Dog walks logged today: `entry_type = activity`, local calendar day, and
 * `notes` containing the dog-walk marker (PT uses the same entry type but a
 * different marker, so it is not counted here).
 */
export async function fetchTodayDogWalkCountForCurrentUser(): Promise<{
  count: number;
  hasSession: boolean;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { count: 0, hasSession: false };

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) return { count: 0, hasSession: false };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const escaped = DOG_WALK_MARKER.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const likePattern = `%${escaped}%`;

  const { count, error } = await sb
    .from("daily_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("entry_type", ENTRY_TYPE_ACTIVITY)
    .gte("recorded_at", start.toISOString())
    .lt("recorded_at", end.toISOString())
    .like("notes", likePattern);

  if (error) {
    console.warn("today dog walk count fetch:", error.message);
    return { count: 0, hasSession: true };
  }

  return { count: count ?? 0, hasSession: true };
}

/**
 * After inserting water, Supabase reads can briefly lag. Poll until today's sum is at
 * least what the UI already displayed, so optimistic clears don't snap the bar backward.
 */
export async function fetchTodayWaterValueSumUntilAtLeast(
  minOz: number,
): Promise<number> {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    const { oz } = await fetchTodayWaterValueSumForCurrentUser();
    if (oz >= minOz - 0.01) return oz;
    await new Promise((r) => setTimeout(r, 80 + i * 60));
  }
  const { oz } = await fetchTodayWaterValueSumForCurrentUser();
  return Math.max(minOz, oz);
}

/**
 * @deprecated Prefer {@link fetchTodayWaterValueSumForCurrentUser} for cloud baseline.
 */
export async function fetchTodayWaterOzSumForCurrentUser(): Promise<{
  oz: number;
  hasSession: boolean;
}> {
  return fetchTodayWaterValueSumForCurrentUser();
}

export type PersistDailyLogResult =
  | { ok: true }
  | { ok: false; error: string };

export async function persistDailyLogToSupabase(
  entry: DailyLogEntry,
): Promise<PersistDailyLogResult> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "Supabase is not configured." };

  const authUser = await requireAuthUserForSave(sb);
  if (!authUser) {
    return { ok: false, error: "not_signed_in" };
  }
  const uid = authUser.id;

  const payload: Record<string, unknown> = {
    id: entry.id,
    recorded_at: entry.recordedAt,
    category: entry.category,
    label: entry.label,
    notes: entry.notes ?? null,
    sketch_png_base64: entry.sketchPngBase64 ?? null,
    sketch_side: entry.sketchSide ?? null,
    sketch_brush_preset: entry.sketchBrushPreset ?? null,
    entry_type: resolveDailyLogEntryType(entry),
    user_id: uid,
  };

  const et = resolveDailyLogEntryType(entry);
  if (et === ENTRY_TYPE_CAFFEINE) {
    const mg =
      entry.valueMg ??
      Number.parseInt(String(entry.notes ?? "").trim(), 10);
    if (Number.isFinite(mg) && mg > 0) {
      payload.value = mg;
    }
  } else if (et === ENTRY_TYPE_WATER) {
    const oz =
      entry.valueOz ??
      Number.parseInt(String(entry.notes ?? "").trim(), 10);
    if (Number.isFinite(oz) && oz > 0) {
      payload.value = oz;
    }
  }

  const res = await sb.from("daily_logs").insert(payload);
  if (res.error) {
    console.error("[daily_logs] insert failed:", {
      message: res.error.message,
      code: res.error.code,
      details: res.error.details,
      hint: res.error.hint,
      entry_type: payload.entry_type,
    });
    return { ok: false, error: res.error.message };
  }
  return { ok: true };
}
