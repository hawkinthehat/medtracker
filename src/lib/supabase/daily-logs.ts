import type { DailyLogEntry } from "@/lib/types";
import {
  ENTRY_TYPE_WATER,
  ENTRY_TYPE_CAFFEINE,
  ENTRY_TYPE_SODIUM,
  ENTRY_TYPE_FOOD,
  resolveDailyLogEntryType,
} from "@/lib/daily-log-entry-type";
import {
  logDataNotSavedNoUser,
  resolveSupabaseUserId,
} from "@/lib/supabase/auth-save-guard";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { localCalendarDayRecordedAtBounds } from "@/lib/hydration-summary";

type DailyLogRow = {
  id: string;
  recorded_at: string;
  category: DailyLogEntry["category"];
  label: string;
  notes: string | null;
  sketch_png_base64?: string | null;
  sketch_side?: string | null;
  user_id?: string | null;
  /** Standard column; legacy rows may only have {@link DailyLogRow.log_entry_type}. */
  entry_type?: string | null;
  log_entry_type?: string | null;
  unit?: string | null;
  value?: number | null;
};

function rowToEntry(row: DailyLogRow): DailyLogEntry {
  const side = row.sketch_side;
  const v =
    row.value != null && Number.isFinite(Number(row.value))
      ? Number(row.value)
      : undefined;
  const et =
    row.entry_type ?? row.log_entry_type ?? undefined;
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
    unit: row.unit ?? undefined,
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
  if (
    et === ENTRY_TYPE_FOOD ||
    et === "food" ||
    row.category === "food"
  ) {
    if (v != null && Number.isFinite(v) && v > 0) {
      return {
        ...base,
        category: "food",
        entryType: ENTRY_TYPE_FOOD,
        valueKcal: Math.round(v),
        unit: row.unit ?? "kcal",
      };
    }
    return { ...base, category: "food" };
  }
  return v != null && Number.isFinite(v) && v > 0
    ? { ...base, valueOz: Math.round(v) }
    : base;
}

const DAILY_LOG_ROW_SELECT =
  "id,recorded_at,category,label,notes,sketch_png_base64,sketch_side,user_id,entry_type,unit,value";

export async function fetchDailyLogsFromSupabase(): Promise<DailyLogEntry[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("daily_logs")
    .select(DAILY_LOG_ROW_SELECT)
    .order("recorded_at", { ascending: false })
    .limit(800);
  if (error) {
    console.warn("daily_logs fetch:", error.message);
    return [];
  }
  return ((data ?? []) as DailyLogRow[]).map(rowToEntry);
}

function sumNumericColumnFromRows(
  data: { value?: unknown; notes?: string | null }[] | null,
): number {
  let total = 0;
  for (const row of data ?? []) {
    const raw = row.value;
    const fromValue =
      raw != null && String(raw).trim() !== "" && Number.isFinite(Number(raw))
        ? Number(raw)
        : Number.parseInt(String(row.notes ?? "").trim(), 10);
    const addend = Number(fromValue);
    if (Number.isFinite(addend) && addend > 0) total += addend;
  }
  return total;
}

/** All `daily_logs` for the signed-in user’s local calendar day. */
export async function fetchTodayDailyLogsForCurrentUser(): Promise<{
  entries: DailyLogEntry[];
  hasSession: boolean;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { entries: [], hasSession: false };

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) return { entries: [], hasSession: false };

  const { startIso, endIso } = localCalendarDayRecordedAtBounds();

  const { data, error } = await sb
    .from("daily_logs")
    .select(DAILY_LOG_ROW_SELECT)
    .eq("user_id", uid)
    .gte("recorded_at", startIso)
    .lt("recorded_at", endIso)
    .order("recorded_at", { ascending: false });

  if (error) {
    console.warn("today daily_logs fetch:", error.message);
    return { entries: [], hasSession: true };
  }

  return {
    entries: ((data ?? []) as DailyLogRow[]).map(rowToEntry),
    hasSession: true,
  };
}

/** Parallel reads of `daily_logs` for today, filtered by `entry_type`. */
export async function fetchTodayHydrationTotalsFromDailyLogs(): Promise<{
  oz: number;
  caffeineMg: number;
  sodiumMg: number;
  caloriesKcal: number;
  hasSession: boolean;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) {
    return {
      oz: 0,
      caffeineMg: 0,
      sodiumMg: 0,
      caloriesKcal: 0,
      hasSession: false,
    };
  }

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) {
    return {
      oz: 0,
      caffeineMg: 0,
      sodiumMg: 0,
      caloriesKcal: 0,
      hasSession: false,
    };
  }

  const { startIso, endIso } = localCalendarDayRecordedAtBounds();

  const forEntryType = (entryType: string) =>
    sb
      .from("daily_logs")
      .select("value,notes")
      .eq("user_id", uid)
      .eq("entry_type", entryType)
      .gte("recorded_at", startIso)
      .lt("recorded_at", endIso);

  const [wRes, cRes, sRes, fRes] = await Promise.all([
    forEntryType(ENTRY_TYPE_WATER),
    forEntryType(ENTRY_TYPE_CAFFEINE),
    forEntryType(ENTRY_TYPE_SODIUM),
    forEntryType(ENTRY_TYPE_FOOD),
  ]);

  if (wRes.error) {
    console.warn("today daily_logs water sum:", wRes.error.message);
  }
  if (cRes.error) {
    console.warn("today daily_logs caffeine sum:", cRes.error.message);
  }
  if (sRes.error) {
    console.warn("today daily_logs sodium sum:", sRes.error.message);
  }
  if (fRes.error) {
    console.warn("today daily_logs food kcal sum:", fRes.error.message);
  }

  return {
    oz: wRes.error ? 0 : sumNumericColumnFromRows(wRes.data),
    caffeineMg: cRes.error ? 0 : sumNumericColumnFromRows(cRes.data),
    sodiumMg: sRes.error ? 0 : sumNumericColumnFromRows(sRes.data),
    caloriesKcal: fRes.error ? 0 : sumNumericColumnFromRows(fRes.data),
    hasSession: true,
  };
}

/** @deprecated Prefer {@link fetchTodayHydrationTotalsFromDailyLogs}. */
export async function fetchTodayWaterValueSumForCurrentUser(): Promise<{
  oz: number;
  hasSession: boolean;
}> {
  const t = await fetchTodayHydrationTotalsFromDailyLogs();
  return { oz: t.oz, hasSession: t.hasSession };
}

/** @deprecated Prefer {@link fetchTodayHydrationTotalsFromDailyLogs}. */
export async function fetchTodayCaffeineMgSumForCurrentUser(): Promise<{
  mg: number;
  hasSession: boolean;
}> {
  const t = await fetchTodayHydrationTotalsFromDailyLogs();
  return { mg: t.caffeineMg, hasSession: t.hasSession };
}

/** @deprecated Prefer {@link fetchTodayHydrationTotalsFromDailyLogs}. */
export async function fetchTodaySodiumMgSumForCurrentUser(): Promise<{
  mg: number;
  hasSession: boolean;
}> {
  const t = await fetchTodayHydrationTotalsFromDailyLogs();
  return { mg: t.sodiumMg, hasSession: t.hasSession };
}

/**
 * After inserting water, poll until today's sum catches up (no optimistic UI).
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
      entry_type: payload.entry_type,
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
      entry_type: ENTRY_TYPE_WATER,
      unit: entry.unit ?? "oz",
      category: entry.category,
      label: entry.label,
      value: Number(oz),
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
      entry_type: ENTRY_TYPE_CAFFEINE,
      unit: entry.unit ?? "mg",
      category: entry.category,
      label: entry.label,
      value: Number(mg),
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
      entry_type: ENTRY_TYPE_SODIUM,
      unit: entry.unit ?? "mg",
      category: entry.category,
      label: entry.label,
      value: Number(mg),
    };
    const res = await sb.from("daily_logs").insert(payload);
    if (res.error) {
      logInsertFailure(payload, res.error);
      return { ok: false, error: res.error.message };
    }
    return { ok: true };
  }

  if (et === ENTRY_TYPE_FOOD || et === "food") {
    const kcal = entry.valueKcal;
    if (!Number.isFinite(kcal) || !kcal || kcal <= 0) {
      return { ok: false, error: "invalid_food_calories" };
    }
    const description = String(entry.notes ?? "").trim();
    const payload = {
      id: entry.id,
      user_id: uid,
      recorded_at: recordedAtIso,
      entry_type: ENTRY_TYPE_FOOD,
      unit: entry.unit ?? "kcal",
      category: "food" as const,
      label: entry.label,
      value: Math.round(Number(kcal)),
      notes: description.length > 0 ? description : null,
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
    entry_type: et,
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
