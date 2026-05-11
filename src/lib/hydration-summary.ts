import type { DailyLogEntry } from "@/lib/types";
import type { MedicationLogRow } from "@/lib/supabase/medication-logs";
import { isWithinLastDays } from "@/lib/clinical-summary-stats";

export const WATER_OZ_LABEL = "Water (oz)";
export const LEGACY_GLASS_LABEL = "Water glass";

/** Thermotabs tablet ≈ 360 mg sodium chloride per product labeling (adjust if yours differs). */
export const THERMOTABS_SODIUM_MG = 360;
export const DEFAULT_WATER_GOAL_OZ = 100;
export const DEFAULT_SODIUM_GOAL_MG = 3000;

function localDayParts(d: Date) {
  return {
    y: d.getFullYear(),
    m: d.getMonth(),
    day: d.getDate(),
  };
}

export function isSameLocalCalendarDay(iso: string, ref = new Date()) {
  const a = new Date(iso);
  const r = localDayParts(ref);
  const x = localDayParts(a);
  return x.y === r.y && x.m === r.m && x.day === r.day;
}

/** Sum fluid ounces from hydration logs (each row stores oz amount in `notes`). */
export function sumWaterOzToday(
  dailyLogs: DailyLogEntry[],
  ref = new Date(),
): number {
  let oz = 0;
  for (const e of dailyLogs) {
    if (e.category !== "hydration") continue;
    if (e.label !== WATER_OZ_LABEL && e.label !== LEGACY_GLASS_LABEL)
      continue;
    if (!isSameLocalCalendarDay(e.recordedAt, ref)) continue;
    if (e.label === LEGACY_GLASS_LABEL) {
      oz += 8;
      continue;
    }
    const n = Number.parseInt(String(e.notes ?? "").trim(), 10);
    if (Number.isFinite(n) && n > 0) oz += n;
  }
  return oz;
}

/** Total fluid ounces from hydration logs in the rolling `days` window. */
export function sumWaterOzLastDays(
  dailyLogs: DailyLogEntry[],
  days: number,
): number {
  let oz = 0;
  for (const e of dailyLogs) {
    if (e.category !== "hydration") continue;
    if (e.label !== WATER_OZ_LABEL && e.label !== LEGACY_GLASS_LABEL)
      continue;
    if (!isWithinLastDays(e.recordedAt, days)) continue;
    if (e.label === LEGACY_GLASS_LABEL) {
      oz += 8;
      continue;
    }
    const n = Number.parseInt(String(e.notes ?? "").trim(), 10);
    if (Number.isFinite(n) && n > 0) oz += n;
  }
  return oz;
}

/** Sodium from Thermotabs PRN logs in the rolling `days` window (mg). */
export function sumThermotabsSodiumMgLastDays(
  logs: MedicationLogRow[],
  days: number,
): number {
  let tablets = 0;
  for (const row of logs) {
    if (row.medicationName !== "Thermotabs") continue;
    if (!isWithinLastDays(row.recordedAt, days)) continue;
    tablets += 1;
  }
  return tablets * THERMOTABS_SODIUM_MG;
}

/** Sodium from Thermotabs PRN logs today (mg). */
export function sumThermotabsSodiumMgToday(
  logs: MedicationLogRow[],
  ref = new Date(),
): number {
  let n = 0;
  for (const row of logs) {
    if (row.medicationName !== "Thermotabs") continue;
    if (!isSameLocalCalendarDay(row.recordedAt, ref)) continue;
    n += 1;
  }
  return n * THERMOTABS_SODIUM_MG;
}
