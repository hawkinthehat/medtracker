import type { DailyLogEntry } from "@/lib/types";
import {
  ENTRY_TYPE_WATER,
  resolveDailyLogEntryType,
} from "@/lib/daily-log-entry-type";
import {
  logDataNotSavedNoUser,
  resolveSupabaseUserId,
} from "@/lib/supabase/auth-save-guard";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

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
  return {
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
    entryType: row.entry_type ?? undefined,
    valueOz: v,
  };
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

/**
 * @deprecated Prefer {@link fetchTodayWaterValueSumForCurrentUser} for cloud baseline.
 */
export async function fetchTodayWaterOzSumForCurrentUser(): Promise<{
  oz: number;
  hasSession: boolean;
}> {
  return fetchTodayWaterValueSumForCurrentUser();
}

export async function persistDailyLogToSupabase(
  entry: DailyLogEntry,
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) {
    logDataNotSavedNoUser();
    return false;
  }

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
  if (
    et === ENTRY_TYPE_WATER ||
    entry.category === "hydration"
  ) {
    const oz =
      entry.valueOz ??
      Number.parseInt(String(entry.notes ?? "").trim(), 10);
    if (Number.isFinite(oz) && oz > 0) {
      payload.value = oz;
    }
  }

  const { error } = await sb.from("daily_logs").insert(payload);
  if (error) {
    console.warn("daily_logs insert:", error.message, error.code ?? "");
    return false;
  }
  return true;
}
