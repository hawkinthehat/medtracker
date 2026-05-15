import type { DailyLogEntry, VitalRow } from "@/lib/types";
import { ENTRY_TYPE_ACTIVITY } from "@/lib/daily-log-entry-type";
import type { EnvironmentSnapshot } from "@/lib/environment-snapshot";

/** Embedded in `daily_logs.notes` for analytics / counting across label changes. */
export const DOG_WALK_MARKER = "[Tiaki movement:dog-walk]";
/** Stored `daily_logs.label` for dog walk rows (button text may differ). */
export const DOG_WALK_DAILY_LOG_LABEL = "Dog Walk";
export const PT_MARKER_PREFIX = "[Tiaki movement:pt:";

export type PtSlot = "morning" | "noon" | "night";

export function ptMarker(slot: PtSlot): string {
  return `${PT_MARKER_PREFIX}${slot}]`;
}

export function calendarDayLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSameLocalDay(iso: string, day: string): boolean {
  const t = new Date(iso);
  return calendarDayLocal(t) === day;
}

/** Dog walks today: `movement` + `activity` + label "Dog Walk", or legacy notes marker. */
export function countDogWalksToday(
  logs: DailyLogEntry[],
  day = calendarDayLocal(),
): number {
  return logs.filter((e) => {
    if (!isSameLocalDay(e.recordedAt, day)) return false;
    const modern =
      e.entryType === ENTRY_TYPE_ACTIVITY &&
      (e.category === "movement" || e.category === "activity") &&
      e.label === DOG_WALK_DAILY_LOG_LABEL;
    const legacy =
      Boolean(e.notes?.includes(DOG_WALK_MARKER)) &&
      (!e.entryType || e.entryType === ENTRY_TYPE_ACTIVITY);
    return modern || legacy;
  }).length;
}

/**
 * Morning resting HR from vitals (Morning routine) or pulse-only morning log.
 */
export function getMorningHeartRateBpmToday(
  vitals: VitalRow[],
  dailyLogs: DailyLogEntry[],
  day = calendarDayLocal(),
): number | null {
  const vitToday = vitals.filter((v) => isSameLocalDay(v.recordedAt, day));
  const withMorningNote = vitToday.find((v) =>
    (v.notes ?? "").toLowerCase().includes("morning routine"),
  );
  if (
    withMorningNote?.heartRate != null &&
    withMorningNote.heartRate > 0 &&
    withMorningNote.heartRate < 300
  ) {
    return withMorningNote.heartRate;
  }

  const pulseLog = dailyLogs.find(
    (e) =>
      isSameLocalDay(e.recordedAt, day) && e.label === "Morning heart rate",
  );
  if (pulseLog?.notes) {
    const m = pulseLog.notes.match(/(\d+(?:\.\d+)?)\s*bpm/i);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n < 300) return Math.round(n);
    }
  }
  return null;
}

export function appendAmbientContext(
  baseNotes: string,
  snap: EnvironmentSnapshot | null,
): string {
  const lines = [baseNotes.trim()];
  if (snap != null) {
    lines.push("");
    lines.push(`Ambient temp: ${snap.tempC.toFixed(1)}°C`);
    lines.push(`Barometric pressure: ${Math.round(snap.pressureHpa)} hPa`);
    if (snap.humidityPct != null) {
      lines.push(`Relative humidity: ${Math.round(snap.humidityPct)}%`);
    }
    lines.push(`Weather snapshot: ${snap.recordedAt}`);
  }
  return lines.join("\n");
}

/** Parse ambient lines saved by movement logging — for charts / correlation exports. */
export function extractAmbientFromMovementNotes(notes: string | undefined): {
  tempC: number | null;
  pressureHpa: number | null;
  humidityPct: number | null;
} {
  if (!notes?.trim()) {
    return { tempC: null, pressureHpa: null, humidityPct: null };
  }
  let tempC: number | null = null;
  let pressureHpa: number | null = null;
  let humidityPct: number | null = null;
  const t = notes.match(/Ambient temp:\s*([\d.]+)\s*°C/i);
  if (t) {
    const n = Number(t[1]);
    if (Number.isFinite(n)) tempC = n;
  }
  const p = notes.match(/Barometric pressure:\s*(\d+)\s*hPa/i);
  if (p) {
    const n = Number(p[1]);
    if (Number.isFinite(n)) pressureHpa = n;
  }
  const h = notes.match(/Relative humidity:\s*(\d+)\s*%/i);
  if (h) {
    const n = Number(h[1]);
    if (Number.isFinite(n)) humidityPct = n;
  }
  return { tempC, pressureHpa, humidityPct };
}
