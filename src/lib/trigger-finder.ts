import type { DailyLogEntry, JournalEntry } from "@/lib/types";
import type { SymptomLogRow } from "@/lib/supabase/symptom-logs";

/** MCAS-style window: symptom within this many minutes after a food log → suspect trigger. */
export const HISTAMINE_TRIGGER_WINDOW_MS = 120 * 60 * 1000;

/**
 * Flags food `daily_logs` rows where a Symptom Matrix quick-tap (`symptom_logs`)
 * occurs within {@link HISTAMINE_TRIGGER_WINDOW_MS} **after** that food.
 */
export function findSuspectedFoodTriggerFoodIdsFromSymptomLogs(
  dailyLogs: DailyLogEntry[],
  symptomLogs: SymptomLogRow[],
  windowMs: number = HISTAMINE_TRIGGER_WINDOW_MS,
): Set<string> {
  const foods = dailyLogs.filter((d) => d.category === "food");
  const ids = new Set<string>();

  for (const food of foods) {
    const foodTime = new Date(food.recordedAt).getTime();
    if (Number.isNaN(foodTime)) continue;

    for (const row of symptomLogs) {
      const t = new Date(row.recordedAt).getTime();
      if (Number.isNaN(t)) continue;
      if (t >= foodTime && t - foodTime <= windowMs) {
        ids.add(food.id);
        break;
      }
    }
  }

  return ids;
}

/**
 * Union of journal-based and Symptom Matrix–based suspected food triggers.
 */
export function findSuspectedFoodTriggerFoodIds(
  dailyLogs: DailyLogEntry[],
  journalEntries: JournalEntry[],
  symptomLogs: SymptomLogRow[],
  windowMs: number = HISTAMINE_TRIGGER_WINDOW_MS,
): Set<string> {
  const fromJournal = findSuspectedHistamineTriggerFoodIds(
    dailyLogs,
    journalEntries,
    windowMs,
  );
  const fromSymptoms = findSuspectedFoodTriggerFoodIdsFromSymptomLogs(
    dailyLogs,
    symptomLogs,
    windowMs,
  );
  return new Set([...fromJournal, ...fromSymptoms]);
}

/**
 * Flags food `daily_logs` rows where a `symptom_journal` entry occurs within 120 minutes
 * **after** that food (for MCAS / histamine timing).
 */
export function findSuspectedHistamineTriggerFoodIds(
  dailyLogs: DailyLogEntry[],
  journalEntries: JournalEntry[],
  windowMs: number = HISTAMINE_TRIGGER_WINDOW_MS,
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
        journalTime - foodTime <= windowMs
      ) {
        ids.add(food.id);
        break;
   