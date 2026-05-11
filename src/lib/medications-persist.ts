import type { QueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { SavedMedication } from "@/lib/seed-medications";
import { persistMedicationsToStorage } from "@/lib/medications-storage";

export function setMedicationsAndPersist(
  qc: QueryClient,
  updater: (prev: SavedMedication[]) => SavedMedication[],
): void {
  qc.setQueryData<SavedMedication[]>(qk.medications, (prev = []) => {
    const next = updater(prev);
    persistMedicationsToStorage(next);
    return next;
  });
}
