import type { SavedMedication } from "@/lib/seed-medications";

export type DoseUnit = "mg" | "mcg";

/** Per-medication schedule + dose display (local / React Query). */
export type MedicationProfile = {
  doseValue: number;
  doseUnit: DoseUnit;
  /** One or more HH:MM times (local). */
  scheduledTimes: string[];
};

export type MedicationHistoryChangeKind =
  | "dose"
  | "time"
  | "dose_time"
  | "taper"
  | "course_end";

/** Mirrors `public.medication_history` and React Query cache. */
export type MedicationHistoryEntry = {
  id: string;
  medicationId: string;
  medicationName: string;
  recordedAt: string;
  changeKind: MedicationHistoryChangeKind;
  oldDoseLabel: string | null;
  newDoseLabel: string | null;
  oldScheduledTimes: string[] | null;
  newScheduledTimes: string[] | null;
  reason: string;
  taperSegments?: { doseMg: number; days: number }[] | null;
};

export type TaperSegment = { doseMg: number; days: number };

export type TaperPlan = {
  medicationId: string;
  medicationName: string;
  /** Local calendar day the taper begins */
  startDateKey: string;
  segments: TaperSegment[];
};

export type TaperSensitivityEvent = {
  id: string;
  recordedAt: string;
  kind: "mood_crisis" | "brain_fog_total";
  medicationNamesInTaper: string[];
  note: string;
};

/** Meds where taper UI is offered (name match, case-insensitive). */
export const TAPER_ELIGIBLE_NORMALIZED_NAMES = new Set([
  "duloxetine",
  "lorazepam",
]);

export function isTaperEligibleMed(m: SavedMedication): boolean {
  return TAPER_ELIGIBLE_NORMALIZED_NAMES.has(m.name.trim().toLowerCase());
}

export function formatDoseLabel(value: number, unit: DoseUnit): string {
  if (unit === "mcg") {
    return `${Math.round(value)} mcg`;
  }
  const v = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${v} mg`;
}

export function toMg(value: number, unit: DoseUnit): number {
  return unit === "mcg" ? value / 1000 : value;
}
