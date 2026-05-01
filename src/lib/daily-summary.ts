import type { DailyLogEntry, JournalEntry } from "@/lib/types";

/** Food ↔ symptom entries within this window are flagged as possible MCAS triggers. */
export const MCAS_PROXIMITY_MS = 2 * 60 * 60 * 1000;

export type TimelineRow =
  | { source: "daily_log"; entry: DailyLogEntry }
  | { source: "symptom_journal"; entry: JournalEntry };

function recordedAt(row: TimelineRow): string {
  return row.entry.recordedAt;
}

export function buildMergedTimeline(
  dailyLogs: DailyLogEntry[],
  journalEntries: JournalEntry[]
): TimelineRow[] {
  const rows: TimelineRow[] = [
    ...dailyLogs.map((entry) => ({ source: "daily_log" as const, entry })),
    ...journalEntries.map((entry) => ({
      source: "symptom_journal" as const,
      entry,
    })),
  ];
  rows.sort(
    (a, b) =>
      new Date(recordedAt(b)).getTime() - new Date(recordedAt(a)).getTime()
  );
  return rows;
}

/**
 * Highlights IDs where a food daily_log and a symptom_journal entry fall within
 * `MCAS_PROXIMITY_MS` of each other.
 */
export function computeMcasProximityIds(
  dailyLogs: DailyLogEntry[],
  journalEntries: JournalEntry[]
): Set<string> {
  const foods = dailyLogs.filter((d) => d.category === "food");
  const ids = new Set<string>();
  for (const f of foods) {
    const ft = new Date(f.recordedAt).getTime();
    if (Number.isNaN(ft)) continue;
    for (const j of journalEntries) {
      const jt = new Date(j.recordedAt).getTime();
      if (Number.isNaN(jt)) continue;
      if (Math.abs(ft - jt) <= MCAS_PROXIMITY_MS) {
        ids.add(f.id);
        ids.add(j.id);
      }
    }
  }
  return ids;
}
