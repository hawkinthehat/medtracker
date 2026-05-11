import type { DailyLogEntry } from "@/lib/types";
import { isSameLocalCalendarDay } from "@/lib/hydration-summary";

/** Legacy label before `entry_type` existed — still matched for older rows. */
export const MORNING_MEDS_TAKEN_LABEL = "Morning meds taken";

/** Semantic tag stored in `daily_logs.entry_type`. */
export const MORNING_MEDS_ENTRY_TYPE = "morning_meds_completed";

export function findMorningMedsLogToday(
  dailyLogs: DailyLogEntry[],
  ref = new Date(),
): DailyLogEntry | undefined {
  return dailyLogs.find(
    (e) =>
      isSameLocalCalendarDay(e.recordedAt, ref) &&
      (e.entryType === MORNING_MEDS_ENTRY_TYPE ||
        e.label === MORNING_MEDS_TAKEN_LABEL),
  );
}
