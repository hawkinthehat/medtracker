"use client";

import { useLayoutEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { loadMedicationsFromStorage, persistMedicationsToStorage } from "@/lib/medications-storage";
import type { SavedMedication } from "@/lib/seed-medications";

/** Hydrates TanStack cache from device storage before UI reads medications. */
export default function MedicationsHydrator() {
  const qc = useQueryClient();
  const ran = useRef(false);

  useLayoutEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const fromDisk = loadMedicationsFromStorage();
    if (fromDisk.length > 0) {
      qc.setQueryData(qk.medications, fromDisk);
      return;
    }
    const existing = qc.getQueryData<SavedMedication[]>(qk.medications);
    if (existing?.length) {
      persistMedicationsToStorage(existing);
    }
  }, [qc]);

  return null;
}
