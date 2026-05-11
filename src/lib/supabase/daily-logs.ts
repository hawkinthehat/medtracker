import type { DailyLogEntry } from "@/lib/types";
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
  };
}

export async function fetchDailyLogsFromSupabase(): Promise<DailyLogEntry[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("daily_logs")
    .select(
      "id,recorded_at,category,label,notes,sketch_png_base64,sketch_side,sketch_brush_preset",
    )
    .order("recorded_at", { ascending: false })
    .limit(800);
  if (error) {
    console.warn("daily_logs fetch:", error.message);
    return [];
  }
  return ((data ?? []) as DailyLogRow[]).map(rowToEntry);
}

export async function persistDailyLogToSupabase(
  entry: DailyLogEntry,
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;
  const { error } = await sb.from("daily_logs").insert({
    id: entry.id,
    recorded_at: entry.recordedAt,
    category: entry.category,
    label: entry.label,
    notes: entry.notes ?? null,
    sketch_png_base64: entry.sketchPngBase64 ?? null,
    sketch_side: entry.sketchSide ?? null,
    sketch_brush_preset: entry.sketchBrushPreset ?? null,
  });
  if (error) {
    console.warn("daily_logs insert:", error.message, error.code ?? "");
    return false;
  }
  return true;
}
