import type { DailyLogEntry, JournalEntry } from "@/lib/types";

/** MCAS-style window: symptom within this many minutes after a food log → suspect trigger. */
export const HISTAMINE_TRIGGER_WINDOW_MS = 120 * 60 * 1000;

/**
 * Flags food `daily_logs` rows where a `symptom_journal` entry occurs within 120 minutes
 * **after** that food (for MCAS / histamine timing).
 */
export function findSuspectedHistamineTriggerFoodIds(
  dailyLogs: DailyLogEntry[],
  journalEntries: JournalEntry[]
): Set<string> {
  const foods = dailyLogs.filter((d) => d.category === "food");
  const ids = new Set<string>();

  for (const food of foods) {
    const foodTime = new Date(food.recordedAt).getTime();
    if (Number.isNaN(foodTime)) continue;

    for (const entry of journalEntries) {
      const journalTime = new Date(entry.recordedAt).getTime();
      if (Number.isNaN(journalTime)) continue;

      if (
        journalTime >= foodTime &&
        journalTime - foodTime <= HISTAMINE_TRIGGER_WINDOW_MS
      ) {
        ids.add(food.id);
        break;
      }
    }
  }

  return ids;
}
