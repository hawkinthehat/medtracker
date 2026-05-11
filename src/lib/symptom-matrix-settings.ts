import {
  SYMPTOM_MATRIX_PILLAR_IDS,
  type SymptomMatrixPillarId,
} from "@/lib/symptom-matrix-data";

const LS_KEY = "medtracker-symptom-matrix-pinned-v1";

export function loadPinnedSymptomCategories(): SymptomMatrixPillarId[] {
  if (typeof window === "undefined") return [...SYMPTOM_MATRIX_PILLAR_IDS];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [...SYMPTOM_MATRIX_PILLAR_IDS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...SYMPTOM_MATRIX_PILLAR_IDS];
    const next = parsed.filter((x): x is SymptomMatrixPillarId =>
      SYMPTOM_MATRIX_PILLAR_IDS.includes(x as SymptomMatrixPillarId),
    );
    return next;
  } catch {
    return [...SYMPTOM_MATRIX_PILLAR_IDS];
  }
}

export function savePinnedSymptomCategories(cats: SymptomMatrixPillarId[]): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(cats));
    window.dispatchEvent(new Event("tiaki-symptom-matrix-pinned-updated"));
  } catch {
    /* ignore */
  }
}
