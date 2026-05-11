import type { Medication } from "@/lib/metabolic";

/** Prescribed frequency hint for morning-slot checklist (2× / 3× daily). */
export type FrequencyHint = "1x" | "2x" | "3x" | "prn";

export type SavedMedication = Medication & {
  id: string;
  /** Bold UI line, e.g. "100mg · 2× daily" */
  doseLabel?: string;
  frequencyHint?: FrequencyHint;
  /** Short course with explicit calendar bounds (local device dates). */
  isTemporary?: boolean;
  tempStartDate?: string;
  tempEndDate?: string;
  /** After end date, one `course_end` row is written to medication_history; local dedupe. */
  tempCourseEndLogged?: boolean;
};

/**
 * No bundled medication list — users add via Meds, Quick Setup, or import.
 * @deprecated Use `loadMedicationsFromStorage` / `fetchMedicationsQuery` (empty when unset).
 */
export const SEED_SAVED_MEDICATIONS: SavedMedication[] = [];

export function morningSlotMedications(
  meds: SavedMedication[],
): SavedMedication[] {
  return meds.filter(
    (m) => m.frequencyHint === "2x" || m.frequencyHint === "3x",
  );
}
