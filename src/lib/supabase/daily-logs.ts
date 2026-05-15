import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  withTimeoutMs,
} from "@/lib/supabase/auth-save-guard";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { localCalendarDayRecordedAtBounds } from "@/lib/hydration-summary";
import { qk } from "@/lib/query-keys";

type DailyLogRow = {
  id: string;
  recorded_at: string;
  created_at?: string | null;
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
  /** Postgres / PostgREST may return numeric as string — always coerce with {@link coerceDailyLogValue}. */
  value?: unknown;
};

/** Coerce `daily_logs.value` for math (handles numeric strings from Supabase). */
export function coerceDailyLogValue(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : undefined;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Older `daily_logs` rows constrain `category` to food|hydration|sleep|activity|other.
 * The app uses richer {@link DailyLogEntry} categories — map before insert so PostgREST
 * does not reject rows (water used `hydration` and worked; salt/dog used invalid values).
 */
export function dailyLogsCategoryForInsert(
  category: DailyLogEntry["category"] | undefined,
): "food" | "hydration" | "sleep" | "activity" | "other" {
  switch (category) {
    case "food":
      return "food";
    case "hydration":
      return "hydration";
    case "sleep":
      return "sleep";
    case "activity":
    case "movement":
      return "activity";
    case "other":
      return "other";
    default:
      return "other";
  }
}

function rowToEntry(row: DailyLogRow): DailyLogEntry {
  const side = row.sketch_side;
  const v = coerceDailyLogValue(row.value);
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
      ? { ...base, category: "caffeine", valueMg: Math.round(v) }
      : { ...base, category: "caffeine" };
  }
  if (
    et === ENTRY_TYPE_SODIUM ||
    et === "sodium" ||
    row.category === "sodium"
  ) {
    return v != null && Number.isFinite(v) && v > 0
      ? { ...base, category: "sodium", valueMg: Math.round(v) }
      : { ...base, category: "sodium" };
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
  const uid = await resolveSupabaseUserId(sb);
  if (!uid) {
    return [];
  }
  const { data, error } = await sb
    .from("daily_logs")
    .select(DAILY_LOG_ROW_SELECT)
    .eq("user_id", uid)
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
    const fromValue =
      coerceDailyLogValue(row.value) ??
      Number.parseInt(String(row.notes ?? "").trim(), 10);
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

const DAILY_LOG_ROW_SELECT_WITH_CREATED_AT = `${DAILY_LOG_ROW_SELECT},created_at`;

/**
 * All `daily_logs` for the signed-in user whose `created_at` falls on the device’s
 * local calendar day. Water and salt are loaded with explicit `entry_type` filters;
 * caffeine and food share one query.
 */
export async function fetchTodayDailyLogsByCreatedAtForCurrentUser(): Promise<{
  entries: DailyLogEntry[];
  hasSession: boolean;
  /** False when Supabase returned an error — do not overwrite cached totals. */
  ok: boolean;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { entries: [], hasSession: false, ok: false };

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) return { entries: [], hasSession: false, ok: false };

  const { startIso, endIso } = localCalendarDayRecordedAtBounds();

  const inCreatedWindow = () =>
    sb
      .from("daily_logs")
      .select(DAILY_LOG_ROW_SELECT_WITH_CREATED_AT)
      .eq("user_id", uid)
      .gte("created_at", startIso)
      .lt("created_at", endIso);

  const [wRes, sRes, cfRes] = await Promise.all([
    inCreatedWindow().eq("entry_type", ENTRY_TYPE_WATER),
    inCreatedWindow().eq("entry_type", ENTRY_TYPE_SODIUM),
    inCreatedWindow().in("entry_type", [ENTRY_TYPE_CAFFEINE, ENTRY_TYPE_FOOD]),
  ]);

  if (wRes.error || sRes.error || cfRes.error) {
    const parts = [wRes.error, sRes.error, cfRes.error]
      .filter(Boolean)
      .map((e) => e!.message);
    console.warn("today daily_logs by created_at:", parts.join("; "));
    return { entries: [], hasSession: true, ok: false };
  }

  const byId = new Map<string, DailyLogRow>();
  for (const row of (wRes.data ?? []) as DailyLogRow[]) {
    byId.set(row.id, row);
  }
  for (const row of (sRes.data ?? []) as DailyLogRow[]) {
    byId.set(row.id, row);
  }
  for (const row of (cfRes.data ?? []) as DailyLogRow[]) {
    byId.set(row.id, row);
  }

  const merged = Array.from(byId.values()).sort((a, b) => {
    const ta = Date.parse(String(a.created_at ?? a.recorded_at));
    const tb = Date.parse(String(b.created_at ?? b.recorded_at));
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });

  return {
    entries: merged.map(rowToEntry),
    hasSession: true,
    ok: true,
  };
}

/** Totals written by {@link applyTodaysDailyLogsFullCycleToQueryClient} (water / salt / caffeine / food from DB). */
export type DailyLogsFullCycleHydrationTotals = {
  oz: number;
  caffeineMg: number;
  sodiumMg: number;
  caloriesKcal: number;
  hasSession: true;
};

/**
 * Recompute React Query hydration totals from a DB round-trip. Uses the same
 * `recorded_at` local-day window and `entry_type` sums as
 * {@link fetchTodayHydrationTotalsFromDailyLogs} (what inserts set and what the
 * tracker query reads). Avoids {@link fetchTodayDailyLogsByCreatedAtForCurrentUser}
 * here — filtering by `created_at` can miss new rows (null column, clock skew, or
 * mismatch with `recorded_at`), which produced optimistic fills then zeros after sync.
 */
export async function applyTodaysDailyLogsFullCycleToQueryClient(
  qc: QueryClient,
): Promise<DailyLogsFullCycleHydrationTotals | null> {
  try {
    const row = await fetchTodayHydrationTotalsFromDailyLogs();
    if (!row.hasSession) return null;

    const totals: DailyLogsFullCycleHydrationTotals = {
      oz: row.oz,
      caffeineMg: row.caffeineMg,
      sodiumMg: row.sodiumMg,
      caloriesKcal: row.caloriesKcal,
      hasSession: true,
    };

    qc.setQueriesData(
      { queryKey: [...qk.hydrationTotalsTodayRoot] },
      () => totals,
    );

    // `exact: true` — `qk.hydrationTotalsTodayRoot` starts with `"dailyLogs"`; a
    // prefix invalidate would refetch totals and race the insert, clobbering the
    // values we just wrote with `setQueriesData` above.
    // Defer list refetch: immediate refetch can return before PostgREST sees the new
    // row, wiping optimistic `daily_logs` cache and freezing salt/water bars.
    globalThis.setTimeout(() => {
      void qc.invalidateQueries({ queryKey: qk.dailyLogs, exact: true });
    }, 650);
    return totals;
  } catch (e) {
    console.error("[daily_logs] full-cycle hydration sync failed:", e);
    return null;
  }
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
  try {
    return await withTimeoutMs(
      persistDailyLogToSupabaseCore(sb, entry),
      28_000,
      "Save timed out — check your connection.",
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/**
 * Same insert path as {@link persistDailyLogToSupabase} without the outer timeout —
 * for optimistic UI + background sync where the save-guard timeout must not block.
 */
export async function persistDailyLogToSupabaseNoTimeout(
  entry: DailyLogEntry,
): Promise<PersistDailyLogResult> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "Supabase is not configured." };
  try {
    return await persistDailyLogToSupabaseCore(sb, entry);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

async function persistDailyLogToSupabaseCore(
  client: SupabaseClient,
  entry: DailyLogEntry,
): Promise<PersistDailyLogResult> {
  const uid = await resolveSupabaseUserId(client);
  if (!uid) {
    logDataNotSavedNoUser();
    return { ok: false, error: "not_signed_in" };
  }
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

  function isJwtLikeInsertFailure(err: {
    message: string;
    code?: string;
  }): boolean {
    const m = `${err.message} ${err.code ?? ""}`.toLowerCase();
    return (
      m.includes("jwt") ||
      m.includes("expired") ||
      m.includes("401") ||
      m.includes("pgrst301")
    );
  }

  async function insertDailyLogRow(
    payload: Record<string, unknown>,
  ): Promise<PersistDailyLogResult> {
    let res = await client.from("daily_logs").insert(payload);
    if (!res.error) return { ok: true };
    if (isJwtLikeInsertFailure(res.error)) {
      await client.auth.refreshSession();
      res = await client.from("daily_logs").insert(payload);
      if (!res.error) return { ok: true };
    }
    logInsertFailure(payload, res.error);
    return { ok: false, error: res.error.message };
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
      category: dailyLogsCategoryForInsert(entry.category),
      label: entry.label,
      value: Number(oz),
    };
    return insertDailyLogRow(payload);
  }

  if (et === ENTRY_TYPE_CAFFEINE) {
    const fromVal = coerceDailyLogValue((entry as { value?: unknown }).value);
    const mg =
      (fromVal != null && Number.isFinite(fromVal) && fromVal > 0
        ? fromVal
        : undefined) ??
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
      category: dailyLogsCategoryForInsert(entry.category),
      label: entry.label,
      value: Number(mg),
    };
    return insertDailyLogRow(payload);
  }

  if (et === ENTRY_TYPE_SODIUM) {
    const fromVal = coerceDailyLogValue((entry as { value?: unknown }).value);
    const mg =
      (fromVal != null && Number.isFinite(fromVal) && fromVal > 0
        ? fromVal
        : undefined) ??
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
      category: dailyLogsCategoryForInsert(entry.category),
      label: entry.label,
      value: Number(mg),
    };
    return insertDailyLogRow(payload);
  }

  if (et === ENTRY_TYPE_FOOD || et === "food") {
    const kcal = entry.valueKcal;
    if (!Number.isFinite(kcal) || !kcal || kcal <= 0) {
      return { ok: false, error: "invalid_food_calories" };
    }
    const description = String(entry.notes ?? "").trim();
    const fromEntryRecordedAt = (() => {
      const raw = entry.recordedAt?.trim();
      if (!raw) return null;
      const t = new Date(raw).getTime();
      if (Number.isNaN(t)) return null;
      return new Date(raw).toISOString();
    })();
    const payload = {
      id: entry.id,
      user_id: uid,
      recorded_at: fromEntryRecordedAt ?? recordedAtIso,
      entry_type: ENTRY_TYPE_FOOD,
      unit: entry.unit ?? "kcal",
      category: "food" as const,
      label: entry.label,
      value: Math.round(Number(kcal)),
      notes: description.length > 0 ? description : null,
    };
    return insertDailyLogRow(payload);
  }

  const payload: Record<string, unknown> = {
    id: entry.id,
    user_id: uid,
    recorded_at: recordedAtIso,
    entry_type: et,
    category: dailyLogsCategoryForInsert(entry.category),
    label: entry.label,
    notes: entry.notes ?? null,
  };
  if (entry.sketchPngBase64) {
    payload.sketch_png_base64 = entry.sketchPngBase64;
  }
  if (entry.sketchSide) {
    payload.sketch_side = entry.sketchSide;
  }

  return insertDailyLogRow(payload);
}

