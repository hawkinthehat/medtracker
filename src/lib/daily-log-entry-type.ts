import type { DailyLogEntry } from "@/lib/types";
import {
  MORNING_MEDS_ENTRY_TYPE,
  MORNING_MEDS_TAKEN_LABEL,
} from "@/lib/morning-meds-log";

/** Supabase `daily_logs.log_entry_type` enum value for fluid ounces. */
export const ENTRY_TYPE_WATER = "water";

/** Supabase `daily_logs.log_entry_type` enum value for caffeine mg (`daily_logs.value` = mg). */
export const ENTRY_TYPE_CAFFEINE = "caffeine";

/** Thermotabs sodium tap — `daily_logs.value` = mg NaCl equivalent per tablet. */
export const ENTRY_TYPE_SODIUM = "sodium";

/** Walks / PT rows use `category: movement` with this `log_entry_type`. */
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
  if (entry.category === "food") return "food";
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
