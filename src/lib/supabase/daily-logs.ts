import type { DailyLogEntry } from "@/lib/types";
import { sumWaterOzToday } from "@/lib/hydration-summary";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { resolveDailyLogEntryType } from "@/lib/daily-log-entry-type";

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
};

function rowToEntry(row: DailyLogRow): DailyLogEntry {
  const side = row.sketch_side;
  const brush = row.sketch_brush_preset;
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
  };
}

export async function fetchDailyLogsFromSupabase(): Promise<DailyLogEntry[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("daily_logs")
    .select(
      "id,recorded_at,category,label,notes,sketch_png_base64,sketch_side,sketch_brush_preset,user_id,entry_type",
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
 * Computes today's fluid oz for the signed-in user by querying `daily_logs`
 * for the local calendar day (same rules as {@link sumWaterOzToday}).
 */
export async function fetchTodayWaterOzSumForCurrentUser(): Promise<{
  oz: number;
  hasSession: boolean;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { oz: 0, hasSession: false };

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { oz: 0, hasSession: false };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data, error } = await sb
    .from("daily_logs")
    .select(
      "id,recorded_at,category,label,notes,sketch_png_base64,sketch_side,sketch_brush_preset,user_id,entry_type",
    )
    .eq("user_id", user.id)
    .gte("recorded_at", start.toISOString())
    .lt("recorded_at", end.toISOString());

  if (error) {
    console.warn("today water oz fetch:", error.message);
    return { oz: 0, hasSession: true };
  }

  const entries = ((data ?? []) as DailyLogRow[]).map(rowToEntry);
  return { oz: sumWaterOzToday(entries), hasSession: true };
}

export async function persistDailyLogToSupabase(
  entry: DailyLogEntry,
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;

  const {
    data: { user },
  } = await sb.auth.getUser();

  const resolvedUserId = entry.userId ?? user?.id;

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
  };

  if (resolvedUserId) {
    payload.user_id = resolvedUserId;
  }

  const { error } = await sb.from("daily_logs").insert(payload);
  if (error) {
    console.warn("daily_logs insert:", error.message, error.code ?? "");
    return false;
  }
  return true;
}
