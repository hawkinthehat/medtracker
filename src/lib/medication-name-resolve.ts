import type { Medication } from "@/lib/metabolic";
import type { SavedMedication } from "@/lib/seed-medications";

/** Saved meds only — used for Smart Add name matching (no bundled seed list). */
export function buildMedicationLookupCatalog(
  currentMeds: SavedMedication[],
): SavedMedication[] {
  const map = new Map<string, SavedMedication>();
  for (const m of currentMeds) {
    map.set(m.name.toLowerCase(), m);
  }
  return Array.from(map.values());
}

function medicationToDraft(m: SavedMedication): Medication {
  return {
    name: m.name,
    pathway: m.pathway,
    is_inhibitor: m.is_inhibitor,
    is_substrate: m.is_substrate,
    has_orthostatic_hypotension: m.has_orthostatic_hypotension,
    has_dizziness_side_effect: m.has_dizziness_side_effect,
    pathway_role: m.pathway_role,
  };
}

/**
 * Match typed text to the catalog (exact name, then longest-prefix match among seeds).
 * Unknown names become a conservative draft for preview until the user visits Meds for detail.
 */
export function resolveMedicationDraftFromCatalog(
  query: string,
  catalog: SavedMedication[]
): Medication {
  const q = query.trim();
  if (!q) {
    return {
      name: "",
      pathway: "CYP3A4",
      is_inhibitor: false,
      is_substrate: false,
    };
  }
  const lower = q.toLowerCase();
  const candidates = catalog.filter((m) =>
    m.name.toLowerCase().startsWith(lower)
  );
  if (candidates.length === 0) {
    return {
      name: q,
      pathway: "Other / Unknown",
      is_inhibitor: false,
      is_substrate: false,
    };
  }
  const exact = candidates.find((m) => m.name.toLowerCase() === lower);
  const picked =
    exact ??
    [...candidates].sort((a, b) => a.name.localeCompare(b.name))[0];
  return medicationToDraft(picked);
}
