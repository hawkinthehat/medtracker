import { loadMedicationsFromStorage } from "@/lib/medications-storage";
import type { SavedMedication } from "@/lib/seed-medications";

/** TanStack Query `queryFn` — hydrates from local device storage (no bundled seed list). */
export async function fetchMedicationsQuery(): Promise<SavedMedication[]> {
  return loadMedicationsFromStorage();
}
