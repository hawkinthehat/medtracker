import type { DailyLogEntry } from "@/lib/types";
import { isSameLocalCalendarDay } from "@/lib/hydration-summary";

/** Single morning meds acknowledgement row — replaces per-med checklist. */
export const MORNING_MEDS_TAKEN_LABEL = "Morning meds taken";

export function findMorningMedsLogToday(
  dailyLogs: DailyLogEntry[],
  ref = new Date(),
): DailyLogEntry | undefined {
  return dailyLogs.find(
    (e) =>
      e.label === MORNING_MEDS_TAKEN_LABEL &&
      isSameLocalCalendarDay(e.recordedAt, ref),
  );
}
