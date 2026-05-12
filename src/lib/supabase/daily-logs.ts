import type { DailyLogEntry } from "@/lib/types";
import {
  ENTRY_TYPE_WATER,
  ENTRY_TYPE_CAFFEINE,
  ENTRY_TYPE_SODIUM,
  ENTRY_TYPE_ACTIVITY,
  resolveDailyLogEntryType,
} from "@/lib/daily-log-entry-type";
import {
  logDataNotSavedNoUser,
  resolveSupabaseUserId,
} from "@/lib/supabase/auth-save-guard";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { localCalendarDayRecordedAtBounds } from "@/lib/hydration-summary";
import { DOG_WALK_DAILY_LOG_LABEL } from "@/lib/movement-tracking";

type DailyLogRow = {
  id: string;
  recorded_at: string;
  category: DailyLogEntry["category"];
  label: string;
  notes: string | null;
  sketch_png_base64?: string | null;
  sketch_side?: string | null;
  user_id?: string | null;
  log_entry_type?: string | null;
  value?: number | null;
};

function rowToEntry(row: DailyLogRow): DailyLogEntry {
  const side = row.sketch_side;
  const v =
    row.value != null && Number.isFinite(Number(row.value))
      ? Number(row.value)
      : undefined;
  const et = row.log_entry_type ?? undefined;
  const base: DailyLogEntry = {
    id: row.id,
    recordedAt: row.recorded_at,
    category: row.category,
    label: row.label,
    notes: row.notes ?? undefined,
    sketchPngBase64: row.sketch_png_base64 ?? undefined,
    sketchSide:
      side === "front" || side === "back" ? side : undefined,
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
  if (
    et === ENTRY_TYPE_SODIUM ||
    et === "sodium" ||
    row.category === "sodium"
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
      "id,recorded_at,category,label,notes,sketch_png_base64,sketch_side,user_id,log_entry_type,value",
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
 * Sum of `daily_logs.value` for today's rows with `log_entry_type = 'water'`.
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

  const { startIso, endIso } = localCalendarDayRecordedAtBounds();

  const { data, error } = await sb
    .from("daily_logs")
    .select("value,notes")
    .eq("user_id", uid)
    .eq("log_entry_type", ENTRY_TYPE_WATER)
    .eq("category", "hydration")
    .gte("recorded_at", startIso)
    .lt("recorded_at", endIso);

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

/** Sum of `daily_logs.value` for today where `log_entry_type` is caffeine (mg). */
export async function fetchTodayCaffeineMgSumForCurrentUser(): Promise<{
  mg: number;
  hasSession: boolean;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { mg: 0, hasSession: false };

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) return { mg: 0, hasSession: false };

  const { startIso, endIso } = localCalendarDayRecordedAtBounds();

  const { data, error } = await sb
    .from("daily_logs")
    .select("value,notes")
    .eq("user_id", uid)
    .eq("log_entry_type", ENTRY_TYPE_CAFFEINE)
    .eq("category", "caffeine")
    .gte("recorded_at", startIso)
    .lt("recorded_at", endIso);

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

/** Sum of `daily_logs.value` for today where `log_entry_type` is sodium (mg). */
export async function fetchTodaySodiumMgSumForCurrentUser(): Promise<{
  mg: number;
  hasSession: boolean;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { mg: 0, hasSession: false };

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) return { mg: 0, hasSession: false };

  const { startIso, endIso } = localCalendarDayRecordedAtBounds();

  const { data, error } = await sb
    .from("daily_logs")
    .select("value,notes")
    .eq("user_id", uid)
    .eq("log_entry_type", ENTRY_TYPE_SODIUM)
    .eq("category", "sodium")
    .gte("recorded_at", startIso)
    .lt("recorded_at", endIso);

  if (error) {
    console.warn("today sodium sum fetch:", error.message);
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
 * Dog walks today: same user, local calendar day on `recorded_at`, and rows
 * matching movement + activity + label "Dog Walk".
 */
export async function fetchTodayDogWalkCountForCurrentUser(): Promise<{
  count: number;
  hasSession: boolean;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { count: 0, hasSession: false };

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) return { count: 0, hasSession: false };

  const { startIso, endIso } = localCalendarDayRecordedAtBounds();

  const { count, error } = await sb
    .from("daily_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("log_entry_type", ENTRY_TYPE_ACTIVITY)
    .eq("category", "movement")
    .eq("label", DOG_WALK_DAILY_LOG_LABEL)
    .gte("recorded_at", startIso)
    .lt("recorded_at", endIso);

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

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id) {
    logDataNotSavedNoUser();
    return { ok: false, error: "not_signed_in" };
  }
  const uid = user.id;
  const recordedAtIso = new Date().toISOString();
  const et = resolveDailyLogEntryType(entry);

  function logInsertFailure(
    payload: Record<string, unknown>,
    err: { message: string; code?: string; details?: string; hint?: string },
  ) {
    console.error("[daily_logs] insert failed:", {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
      log_entry_type: payload.log_entry_type,
    });
  }

  if (et === ENTRY_TYPE_WATER) {
    const oz =
      entry.valueOz ??
      Number.parseInt(String(entry.notes ?? "").trim(), 10);
    if (!Number.isFinite(oz) || oz <= 0) {
      return { ok: false, error: "invalid_water_value" };
    }
    const payload = {
      id: entry.id,
      user_id: uid,
      recorded_at: recordedAtIso,
      log_entry_type: ENTRY_TYPE_WATER,
      category: entry.category,
      label: entry.label,
      value: oz,
    };
    const res = await sb.from("daily_logs").insert(payload);
    if (res.error) {
      logInsertFailure(payload, res.error);
      return { ok: false, error: res.error.message };
    }
    return { ok: true };
  }

  if (et === ENTRY_TYPE_CAFFEINE) {
    const mg =
      entry.valueMg ??
      Number.parseInt(String(entry.notes ?? "").trim(), 10);
    if (!Number.isFinite(mg) || mg <= 0) {
      return { ok: false, error: "invalid_caffeine_value" };
    }
    const payload = {
      id: entry.id,
      user_id: uid,
      recorded_at: recordedAtIso,
      log_entry_type: ENTRY_TYPE_CAFFEINE,
      category: entry.category,
      label: entry.label,
      value: mg,
    };
    const res = await sb.from("daily_logs").insert(payload);
    if (res.error) {
      logInsertFailure(payload, res.error);
      return { ok: false, error: res.error.message };
    }
    return { ok: true };
  }

  if (et === ENTRY_TYPE_SODIUM) {
    const mg =
      entry.valueMg ??
      Number.parseInt(String(entry.notes ?? "").trim(), 10);
    if (!Number.isFinite(mg) || mg <= 0) {
      return { ok: false, error: "invalid_sodium_value" };
    }
    const payload = {
      id: entry.id,
      user_id: uid,
      recorded_at: recordedAtIso,
      log_entry_type: ENTRY_TYPE_SODIUM,
      category: entry.category,
      label: entry.label,
      value: mg,
    };
    const res = await sb.from("daily_logs").insert(payload);
    if (res.error) {
      logInsertFailure(payload, res.error);
      return { ok: false, error: res.error.message };
    }
    return { ok: true };
  }

  if (
    entry.category === "movement" &&
    et === ENTRY_TYPE_ACTIVITY &&
    entry.label === DOG_WALK_DAILY_LOG_LABEL
  ) {
    const payload = {
      id: entry.id,
      user_id: uid,
      recorded_at: recordedAtIso,
      log_entry_type: ENTRY_TYPE_ACTIVITY,
      category: "movement",
      label: DOG_WALK_DAILY_LOG_LABEL,
      value: 1,
    };
    const res = await sb.from("daily_logs").insert(payload);
    if (res.error) {
      logInsertFailure(payload, res.error);
      return { ok: false, error: res.error.message };
    }
    return { ok: true };
  }

  if (entry.category === "movement" && et === ENTRY_TYPE_ACTIVITY) {
    const payload: Record<string, unknown> = {
      id: entry.id,
      user_id: uid,
      recorded_at: recordedAtIso,
      log_entry_type: ENTRY_TYPE_ACTIVITY,
      category: "movement",
      label: entry.label,
      notes: entry.notes ?? null,
    };
    const res = await sb.from("daily_logs").insert(payload);
    if (res.error) {
      logInsertFailure(payload, res.error);
      return { ok: false, error: res.error.message };
    }
    return { ok: true };
  }

  const payload: Record<string, unknown> = {
    id: entry.id,
    user_id: uid,
    recorded_at: recordedAtIso,
    log_entry_type: et,
    category: entry.category,
    label: entry.label,
    notes: entry.notes ?? null,
  };
  if (entry.sketchPngBase64) {
    payload.sketch_png_base64 = entry.sketchPngBase64;
  }
  if (entry.sketchSide) {
    payload.sketch_side = entry.sketchSide;
  }

  const res = await sb.from("daily_logs").insert(payload);
  if (res.error) {
    logInsertFailure(payload, res.error);
    return { ok: false, error: res.error.message };
  }
  return { ok: true };
}
