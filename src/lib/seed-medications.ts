import type { Medication } from "@/lib/metabolic";

export type SavedMedication = Medication & { id: string };

/** Demo / initial list for metabolic gate and meds UI. */
export const SEED_SAVED_MEDICATIONS: SavedMedication[] = [
  {
    id: "seed-latuda",
    name: "Latuda",
    pathway: "CYP3A4",
    is_inhibitor: false,
    is_substrate: true,
    pathway_role: "CYP3A4 substrate (lurasidone)",
    has_orthostatic_hypotension: true,
  },
  {
    id: "seed-gleevec",
    name: "Gleevec",
    pathway: "CYP3A4",
    is_inhibitor: false,
    is_substrate: true,
    pathway_role: "CYP3A4 substrate (imatinib)",
    has_orthostatic_hypotension: false,
  },
  {
    id: "seed-trazodone",
    name: "Trazodone",
    pathway: "CYP3A4",
    is_inhibitor: false,
    is_substrate: true,
    pathway_role: "CYP3A4 substrate",
    has_orthostatic_hypotension: true,
  },
  {
    id: "seed-fluconazole",
    name: "Fluconazole",
    pathway: "CYP3A4",
    is_inhibitor: true,
    is_substrate: false,
    pathway_role: "CYP3A4 Inhibitor",
  },
  {
    id: "seed-duloxetine",
    name: "Duloxetine",
    pathway: "CYP2D6",
    is_inhibitor: true,
    is_substrate: false,
    pathway_role: "CYP2D6 inhibitor",
    has_orthostatic_hypotension: true,
  },
  {
    id: "seed-lorazepam",
    name: "Lorazepam",
    pathway: "UGT1A1",
    is_inhibitor: false,
    is_substrate: false,
    pathway_role: "UGT conjugation; minimal CYP",
    has_orthostatic_hypotension: true,
  },
  {
    id: "seed-pregabalin",
    name: "Pregabalin",
    pathway: "Renal (Kidneys)",
    is_inhibitor: false,
    is_substrate: false,
    pathway_role: "Renal clearance",
    has_orthostatic_hypotension: false,
    has_dizziness_side_effect: true,
  },
];
