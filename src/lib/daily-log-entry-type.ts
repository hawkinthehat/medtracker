import type { DailyLogEntry } from "@/lib/types";
import {
  MORNING_MEDS_ENTRY_TYPE,
  MORNING_MEDS_TAKEN_LABEL,
} from "@/lib/morning-meds-log";

/** Stored in `daily_logs.entry_type` for fluid ounces rows. */
export const ENTRY_TYPE_WATER = "water";

/** Stored in `daily_logs.entry_type` for caffeine mg (`daily_logs.value` = mg). */
export const ENTRY_TYPE_CAFFEINE = "caffeine";

/**
 * Semantic tag for every `daily_logs` insert — explicit `entry.entryType` wins,
 * otherwise inferred from category / label.
 */
export function resolveDailyLogEntryType(entry: DailyLogEntry): string {
  if (entry.entryType) return entry.entryType;
  if (entry.category === "caffeine") {
    return ENTRY_TYPE_CAFFEINE;
  }
  if (entry.category === "hydration") {
    return ENTRY_TYPE_WATER;
  }
  if (entry.category === "food") return "food";
  if (entry.category === "sleep") return "sleep";
  if (entry.category === "activity") return "activity";
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
