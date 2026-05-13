import type { DailyLogEntry } from "@/lib/types";
import { ENTRY_TYPE_CAFFEINE } from "@/lib/daily-log-entry-type";
import { isSameLocalCalendarDay } from "@/lib/hydration-summary";
import { isWithinLastDays } from "@/lib/clinical-summary-stats";

/** Approximate caffeine per typical coffee (mg). */
export const CAFFEINE_COFFEE_MG = 95;

/** Approximate caffeine per typical energy drink / strong tea (mg). */
export const CAFFEINE_ENERGY_OR_TEA_MG = 160;

export const CAFFEINE_COFFEE_LABEL = "Coffee (≈95 mg caffeine)";
export const CAFFEINE_ENERGY_LABEL = "Energy drink / tea (≈160 mg caffeine)";

export function caffeineMgFromEntry(e: DailyLogEntry): number {
  const isCaffeine =
    e.entryType === ENTRY_TYPE_CAFFEINE ||
    e.entryType === "caffeine" ||
    e.category === "caffeine";
  if (!isCaffeine) return 0;
  const mg = Number(e.valueMg);
  if (e.valueMg != null && Number.isFinite(mg) && mg > 0) {
    return Number(Math.round(mg));
  }
  const n = Number.parseInt(String(e.notes ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? Number(n) : 0;
}

/** Total caffeine (mg) logged for the local calendar day. */
export function sumCaffeineMgToday(
  dailyLogs: DailyLogEntry[],
  ref = new Date(),
): number {
  let mg = 0;
  for (const e of dailyLogs) {
    if (!isSameLocalCalendarDay(e.recordedAt, ref)) continue;
    mg += Number(caffeineMgFromEntry(e));
  }
  return mg;
}

/** Total caffeine (mg) in the rolling `days` window. */
export function sumCaffeineMgLastDays(
  dailyLogs: DailyLogEntry[],
  days: number,
): number {
  let mg = 0;
  for (const e of dailyLogs) {
    if (!isWithinLastDays(e.recordedAt, days)) continue;
    mg += Number(caffeineMgFromEntry(e));
  }
  return mg;
}

/**
 * Mean mg per day over `days` (denominator = `days`), using rolling window totals.
 * Useful for “~X mg/day” on reports.
 */
export function averageDailyCaffeineMgRollingWindow(
  dailyLogs: DailyLogEntry[],
  days: number,
): number {
  if (days <= 0) return 0;
  return sumCaffeineMgLastDays(dailyLogs, days) / days;
}

export function formatCaffeineReportSummary(
  dailyLogs: DailyLogEntry[],
  ref = new Date(),
): string {
  const today = sumCaffeineMgToday(dailyLogs, ref);
  const avg7 = averageDailyCaffeineMgRollingWindow(dailyLogs, 7);
  return (
    `Today (local date): ${today} mg total. ` +
    `Rolling 7-day average: ${avg7.toFixed(0)} mg/day (approximate; taps use fixed estimates per drink type).`
  );
}

/** Recent caffeine rows for PDF table (newest first). */
export function recentCaffeineLogRows(
  dailyLogs: DailyLogEntry[],
  limit = 25,
): DailyLogEntry[] {
  return [...dailyLogs]
    .filter(
      (e) =>
        e.entryType === ENTRY_TYPE_CAFFEINE ||
        e.entryType === "caffeine" ||
        e.category === "caffeine",
    )
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    )
    .slice(0, limit);
}
