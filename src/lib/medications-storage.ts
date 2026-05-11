import type { SavedMedication } from "@/lib/seed-medications";

export const MEDICATIONS_STORAGE_KEY = "medtracker-saved-medications-v1";

export function loadMedicationsFromStorage(): SavedMedication[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MEDICATIONS_STORAGE_KEY);
    if (!raw?.trim()) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedMedication[];
  } catch {
    return [];
  }
}

export function persistMedicationsToStorage(meds: SavedMedication[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEDICATIONS_STORAGE_KEY, JSON.stringify(meds));
  } catch {
    /* ignore quota */
  }
}
