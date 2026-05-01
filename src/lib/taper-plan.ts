import type { TaperPlan, TaperSegment } from "@/lib/medication-profile-types";

export function totalTaperCalendarDays(segments: TaperSegment[]): number {
  return segments.reduce((s, x) => s + Math.max(0, x.days), 0);
}

function parseDateKeyLocal(key: string): Date {
  const [y, mo, d] = key.split("-").map(Number);
  return new Date(y, mo - 1, d, 0, 0, 0, 0);
}

/** Midnight-to-midnight whole days between two local calendar dates. */
export function calendarDaysSinceStart(startDateKey: string, date: Date): number {
  const start = parseDateKeyLocal(startDateKey);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Dose for this local calendar day while taper is active.
 * After the last segment, the last segment dose continues (maintenance).
 */
export function getEffectiveTaperDoseMg(
  plan: TaperPlan,
  date: Date,
  fallbackMg: number
): number {
  const dayIndex = calendarDaysSinceStart(plan.startDateKey, date);
  if (dayIndex < 0) return fallbackMg;
  let cursor = 0;
  for (const seg of plan.segments) {
    const len = Math.max(0, seg.days);
    if (dayIndex < cursor + len) {
      return seg.doseMg;
    }
    cursor += len;
  }
  if (plan.segments.length > 0) {
    return plan.segments[plan.segments.length - 1].doseMg;
  }
  return fallbackMg;
}

/** True if `date` falls within the taper segment timeline (before indefinite maintenance). */
export function isDuringTaperSchedule(plan: TaperPlan, date: Date): boolean {
  const total = totalTaperCalendarDays(plan.segments);
  if (total <= 0) return false;
  const idx = calendarDaysSinceStart(plan.startDateKey, date);
  return idx >= 0 && idx < total;
}

export function hasAnyActiveTaperOnDate(
  plans: Record<string, TaperPlan | undefined>,
  date: Date
): { active: boolean; names: string[] } {
  const names: string[] = [];
  for (const plan of Object.values(plans)) {
    if (!plan) continue;
    if (isDuringTaperSchedule(plan, date)) {
      names.push(plan.medicationName);
    }
  }
  return { active: names.length > 0, names };
}
