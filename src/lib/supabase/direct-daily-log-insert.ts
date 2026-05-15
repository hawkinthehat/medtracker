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
  coerceDailyLogValue,
  dailyLogsCategoryForInsert,
} from "@/lib/supabase/daily-logs";

function isJwtLikeInsertFailure(err: { message: string; code?: string }): boolean {
  const m = `${err.message} ${err.code ?? ""}`.toLowerCase();
  return (
    m.includes("jwt") ||
    m.includes("expired") ||
    m.includes("401") ||
    m.includes("pgrst301")
  );
}

async function insertDailyLogRowWithRetry(
  client: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<{ error: { message: string; code?: string } | null }> {
  let res = await client.from("daily_logs").insert(payload);
  if (!res.error) return { error: null };
  if (isJwtLikeInsertFailure(res.error)) {
    await client.auth.refreshSession();
    res = await client.from("daily_logs").insert(payload);
  }
  return { error: res.error };
}

/**
 * Build PostgREST payload for `daily_logs` — mirrors
 * `persistDailyLogToSupabaseCore` with an explicit `user_id` UUID string.
 */
function buildDailyLogInsertPayload(
  entry: DailyLogEntry,
  userId: string,
): Record<string, unknown> | { error: string } {
  const uid = String(userId).trim();
  if (!uid) return { error: "missing_user_id" };

  const recordedAtIso = new Date().toISOString();
  const et = resolveDailyLogEntryType(entry);

  if (et === ENTRY_TYPE_WATER) {
    const oz =
      entry.valueOz ??
      Number.parseInt(String(entry.notes ?? "").trim(), 10);
    if (!Number.isFinite(oz) || oz <= 0) {
      return { error: "invalid_water_value" };
    }
    return {
      id: entry.id,
      user_id: uid,
      recorded_at: recordedAtIso,
      entry_type: ENTRY_TYPE_WATER,
      unit: entry.unit ?? "oz",
      category: dailyLogsCategoryForInsert(entry.category),
      label: entry.label,
      value: Number(oz),
    };
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
      return { error: "invalid_caffeine_value" };
    }
    return {
      id: entry.id,
      user_id: uid,
      recorded_at: recordedAtIso,
      entry_type: ENTRY_TYPE_CAFFEINE,
      unit: entry.unit ?? "mg",
      category: dailyLogsCategoryForInsert(entry.category),
      label: entry.label,
      value: Number(mg),
    };
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
      return { error: "invalid_sodium_value" };
    }
    return {
      id: entry.id,
      user_id: uid,
      recorded_at: recordedAtIso,
      entry_type: ENTRY_TYPE_SODIUM,
      unit: entry.unit ?? "mg",
      category: dailyLogsCategoryForInsert(entry.category),
      label: entry.label,
      value: Number(mg),
    };
  }

  if (et === ENTRY_TYPE_FOOD || et === "food") {
    const kcal = entry.valueKcal;
    if (!Number.isFinite(kcal) || !kcal || kcal <= 0) {
      return { error: "invalid_food_calories" };
    }
    const description = String(entry.notes ?? "").trim();
    const fromEntryRecordedAt = (() => {
      const raw = entry.recordedAt?.trim();
      if (!raw) return null;
      const t = new Date(raw).getTime();
      if (Number.isNaN(t)) return null;
      return new Date(raw).toISOString();
    })();
    return {
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
  return payload;
}

/**
 * Single `daily_logs` insert via browser client — no `persistDailyLog*` / queue wrappers.
 * `userId` must be the auth user UUID string (never omit on insert).
 */
export async function insertDailyLogDirect(
  client: SupabaseClient,
  userId: string,
  entry: DailyLogEntry,
): Promise<boolean> {
  const built = buildDailyLogInsertPayload(entry, userId);
  if ("error" in built && typeof built.error === "string") {
    console.error("SUPABASE_DIAGNOSTIC:", built);
    return false;
  }
  const payload = built as Record<string, unknown>;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await insertDailyLogRowWithRetry(client, payload);
      if (!error) return true;
      console.error("SUPABASE_DIAGNOSTIC:", error);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    } catch (e) {
      console.error("SUPABASE_DIAGNOSTIC:", e);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }
  return false;
}
