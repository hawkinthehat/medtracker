import type { DailyLogEntry } from "@/lib/types";
import {
  MORNING_MEDS_ENTRY_TYPE,
  MORNING_MEDS_TAKEN_LABEL,
} from "@/lib/morning-meds-log";

/** Supabase `daily_logs.entry_type` for fluid ounces (`value` + `unit` = oz). */
export const ENTRY_TYPE_WATER = "water";

/** Supabase `daily_logs.entry_type` for caffeine (`value` + `unit` = mg). */
export const ENTRY_TYPE_CAFFEINE = "caffeine";

/** Thermotabs sodium tap — `daily_logs.value` + `unit` = mg. */
export const ENTRY_TYPE_SODIUM = "sodium";

/** Smart nutrition — `daily_logs.value` = kcal estimate; `notes` = free-text description. */
export const ENTRY_TYPE_FOOD = "food";

/** Legacy / generic movement-tagged rows (dog walk + PT use `activity_logs` now). */
export const ENTRY_TYPE_ACTIVITY = "activity";

/**
 * Semantic tag for every `daily_logs` insert — explicit `entry.entryType` wins,
 * otherwise inferred from category / label.
 */
export function resolveDailyLogEntryType(entry: DailyLogEntry): string {
  if (entry.entryType) return entry.entryType;
  if (entry.category === "caffeine") {
    return ENTRY_TYPE_CAFFEINE;
  }
  if (entry.category === "sodium") {
    return ENTRY_TYPE_SODIUM;
  }
  if (entry.category === "hydration") {
    return ENTRY_TYPE_WATER;
  }
  if (entry.category === "food") return ENTRY_TYPE_FOOD;
  if (entry.category === "sleep") return "sleep";
  if (entry.category === "movement") {
    return ENTRY_TYPE_ACTIVITY;
  }
  if (entry.category === "activity") return ENTRY_TYPE_ACTIVITY;
  if (entry.category === "medication") {
    if (
      entry.label === MORNING_MEDS_TAKEN_LABEL ||
      entry.label === "Morning meds"
    ) {
      return MORNING_MEDS_ENTRY_TYPE;
    }
    return "medication";
  }
  if (entry.category === "other") {
    if (
      entry.label === MORNING_MEDS_TAKEN_LABEL ||
      entry.label === "Morning meds"
    ) {
      return MORNING_MEDS_ENTRY_TYPE;
    }
    return "other";
  }
  return "other";
}
