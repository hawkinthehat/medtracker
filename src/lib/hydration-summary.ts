import type { DailyLogEntry } from "@/lib/types";
import type { MedicationLogRow } from "@/lib/supabase/medication-logs";
import {
  ENTRY_TYPE_CAFFEINE,
  ENTRY_TYPE_FOOD,
  ENTRY_TYPE_SODIUM,
  ENTRY_TYPE_WATER,
} from "@/lib/daily-log-entry-type";
import { isWithinLastDays } from "@/lib/clinical-summary-stats";

export const WATER_OZ_LABEL = "Water (oz)";
export const LEGACY_GLASS_LABEL = "Water glass";

/** Thermotabs tablet ≈ 360 mg sodium chloride per product labeling (adjust if yours differs). */
export const THERMOTABS_SODIUM_MG = 360;
export const DEFAULT_WATER_GOAL_OZ = 100;
export const DEFAULT_SODIUM_GOAL_MG = 3000;
/** Default daily calorie target for the home hydration strip (editable via prop). */
export const DEFAULT_CALORIE_GOAL_KCAL = 2000;

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

/**
 * Half-open interval for the device’s local calendar day, for filtering
 * `recorded_at` on `daily_logs` / `activity_logs` (`startIso` inclusive, `endIso` exclusive).
 */
export function localCalendarDayRecordedAtBounds(ref = new Date()): {
  startIso: string;
  endIso: string;
} {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Sum fluid ounces from hydration logs (`valueOz` / `daily_logs.value`, else legacy `notes`). */
export function sumWaterOzToday(
  dailyLogs: DailyLogEntry[],
  ref = new Date(),
): number {
  let oz = 0;
  for (const e of dailyLogs) {
    if (!isSameLocalCalendarDay(e.recordedAt, ref)) continue;

    if (
      e.entryType === ENTRY_TYPE_CAFFEINE ||
      e.entryType === "caffeine" ||
      e.category === "caffeine"
    ) {
      continue;
    }

    if (e.entryType === ENTRY_TYPE_WATER || e.entryType === "water") {
      if (e.label === LEGACY_GLASS_LABEL) {
        oz += 8;
        continue;
      }
      const valueOzNum = Number(e.valueOz);
      const fromVal = Number.isFinite(valueOzNum) && valueOzNum > 0
        ? Math.round(valueOzNum)
        : Number.parseInt(String(e.notes ?? "").trim(), 10);
      if (Number.isFinite(fromVal) && fromVal > 0) oz += Number(fromVal);
      continue;
    }

    if (e.category !== "hydration") continue;
    if (e.label !== WATER_OZ_LABEL && e.label !== LEGACY_GLASS_LABEL)
      continue;
    if (e.label === LEGACY_GLASS_LABEL) {
      oz += 8;
      continue;
    }
    const valueOzNum = Number(e.valueOz);
    const fromVal = Number.isFinite(valueOzNum) && valueOzNum > 0
      ? Math.round(valueOzNum)
      : Number.parseInt(String(e.notes ?? "").trim(), 10);
    if (Number.isFinite(fromVal) && fromVal > 0) oz += Number(fromVal);
  }
  return oz;
}

/**
 * Like {@link sumWaterOzToday} but without a calendar filter — caller scopes rows
 * (e.g. `daily_logs` where `created_at` falls on the local day).
 */
export function sumWaterOzInEntries(entries: DailyLogEntry[]): number {
  let oz = 0;
  for (const e of entries) {
    if (
      e.entryType === ENTRY_TYPE_CAFFEINE ||
      e.entryType === "caffeine" ||
      e.category === "caffeine"
    ) {
      continue;
    }

    if (e.entryType === ENTRY_TYPE_WATER || e.entryType === "water") {
      if (e.label === LEGACY_GLASS_LABEL) {
        oz += 8;
        continue;
      }
      const valueOzNum = Number(e.valueOz);
      const fromVal = Number.isFinite(valueOzNum) && valueOzNum > 0
        ? Math.round(valueOzNum)
        : Number.parseInt(String(e.notes ?? "").trim(), 10);
      if (Number.isFinite(fromVal) && fromVal > 0) oz += Number(fromVal);
      continue;
    }

    if (e.category !== "hydration") continue;
    if (e.label !== WATER_OZ_LABEL && e.label !== LEGACY_GLASS_LABEL)
      continue;
    if (e.label === LEGACY_GLASS_LABEL) {
      oz += 8;
      continue;
    }
    const valueOzNum = Number(e.valueOz);
    const fromVal = Number.isFinite(valueOzNum) && valueOzNum > 0
      ? Math.round(valueOzNum)
      : Number.parseInt(String(e.notes ?? "").trim(), 10);
    if (Number.isFinite(fromVal) && fromVal > 0) oz += Number(fromVal);
  }
  return oz;
}

/** Sum estimated kcal from smart nutrition logs (`entry_type` = food) for the local calendar day. */
export function sumFoodKcalToday(
  dailyLogs: DailyLogEntry[],
  ref = new Date(),
): number {
  let kcal = 0;
  for (const e of dailyLogs) {
    if (!isSameLocalCalendarDay(e.recordedAt, ref)) continue;
    const typedFood =
      e.entryType === ENTRY_TYPE_FOOD || e.entryType === "food";
    if (!typedFood) continue;
    const v = Number(e.valueKcal);
    if (Number.isFinite(v) && v > 0) kcal += Math.round(v);
  }
  return kcal;
}

/** Like {@link sumFoodKcalToday} without a calendar filter (caller scopes rows). */
export function sumFoodKcalInEntries(entries: DailyLogEntry[]): number {
  let kcal = 0;
  for (const e of entries) {
    const typedFood =
      e.entryType === ENTRY_TYPE_FOOD || e.entryType === "food";
    if (!typedFood) continue;
    const v = Number(e.valueKcal);
    if (Number.isFinite(v) && v > 0) kcal += Math.round(v);
  }
  return kcal;
}

/** Total fluid ounces from hydration logs in the rolling `days` window. */
export function sumWaterOzLastDays(
  dailyLogs: DailyLogEntry[],
  days: number,
): number {
  let oz = 0;
  for (const e of dailyLogs) {
    if (!isWithinLastDays(e.recordedAt, days)) continue;

    if (e.entryType === ENTRY_TYPE_WATER || e.entryType === "water") {
      if (e.label === LEGACY_GLASS_LABEL) {
        oz += 8;
        continue;
      }
      const valueOzNum = Number(e.valueOz);
      const fromVal = Number.isFinite(valueOzNum) && valueOzNum > 0
        ? Math.round(valueOzNum)
        : Number.parseInt(String(e.notes ?? "").trim(), 10);
      if (Number.isFinite(fromVal) && fromVal > 0) oz += Number(fromVal);
      continue;
    }

    if (e.category !== "hydration") continue;
    if (e.label !== WATER_OZ_LABEL && e.label !== LEGACY_GLASS_LABEL)
      continue;
    if (e.label === LEGACY_GLASS_LABEL) {
      oz += 8;
      continue;
    }
    const valueOzNum = Number(e.valueOz);
    const fromVal = Number.isFinite(valueOzNum) && valueOzNum > 0
      ? Math.round(valueOzNum)
      : Number.parseInt(String(e.notes ?? "").trim(), 10);
    if (Number.isFinite(fromVal) && fromVal > 0) oz += Number(fromVal);
  }
  return oz;
}

/** Sodium from Thermotabs rows in `daily_logs` (same window as medication PRN). */
export function sumThermotabsSodiumMgFromDailyLogsLastDays(
  dailyLogs: DailyLogEntry[],
  days: number,
): number {
  let mg = 0;
  for (const e of dailyLogs) {
    if (!isWithinLastDays(e.recordedAt, days)) continue;
    if (e.entryType !== ENTRY_TYPE_SODIUM && e.entryType !== "sodium") {
      continue;
    }
    const mgRaw = Number(e.valueMg);
    const v = Number.isFinite(mgRaw) && mgRaw > 0
      ? Math.round(mgRaw)
      : Number.parseInt(String(e.notes ?? "").trim(), 10);
    const addend = Number(v);
    if (Number.isFinite(addend) && addend > 0) mg += addend;
  }
  return mg;
}

/** Like {@link sumThermotabsSodiumMgTodayFromDailyLogs} without a calendar filter. */
export function sumSodiumMgDailyLogEntriesInList(entries: DailyLogEntry[]): number {
  let mg = 0;
  for (const e of entries) {
    if (e.entryType !== ENTRY_TYPE_SODIUM && e.entryType !== "sodium") {
      continue;
    }
    const mgRaw = Number(e.valueMg);
    const v = Number.isFinite(mgRaw) && mgRaw > 0
      ? Math.round(mgRaw)
      : Number.parseInt(String(e.notes ?? "").trim(), 10);
    const addend = Number(v);
    if (Number.isFinite(addend) && addend > 0) mg += addend;
  }
  return mg;
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

/** Mg for a `daily_logs` sodium row — prefers `value` (PostgREST) then `valueMg` / `notes`. */
function sodiumMgNumericFromDailyLog(e: DailyLogEntry): number {
  const fromUnknown = (e as { value?: unknown }).value;
  if (fromUnknown != null && String(fromUnknown).trim() !== "") {
    const n = Number(fromUnknown);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  const mgRaw = Number(e.valueMg);
  if (Number.isFinite(mgRaw) && mgRaw > 0) return Math.round(mgRaw);
  const parsed = Number.parseInt(String(e.notes ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Sodium mg today from `daily_logs` rows with `entry_type` = `sodium` (Salt Tracker taps + legacy). */
export function sumThermotabsSodiumMgTodayFromDailyLogs(
  dailyLogs: DailyLogEntry[],
  ref = new Date(),
): number {
  let mg = 0;
  for (const e of dailyLogs) {
    const ra = e.recordedAt?.trim();
    if (ra && !isSameLocalCalendarDay(ra, ref)) continue;
    const isSodium =
      e.entryType === ENTRY_TYPE_SODIUM ||
      e.entryType === "sodium" ||
      e.category === "sodium";
    if (!isSodium) continue;
    const addend = sodiumMgNumericFromDailyLog(e);
    if (addend > 0) mg += addend;
  }
  return mg;
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

/** Legacy medication_logs Thermotabs + `daily_logs` sodium rows (today, mg). */
export function sumThermotabsSodiumMgTodayCombined(
  medicationLogs: MedicationLogRow[],
  dailyLogs: DailyLogEntry[],
  ref = new Date(),
): number {
  return (
    sumThermotabsSodiumMgToday(medicationLogs, ref) +
    sumThermotabsSodiumMgTodayFromDailyLogs(dailyLogs, ref)
  );
}
