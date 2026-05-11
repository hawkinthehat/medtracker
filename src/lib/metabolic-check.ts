import type { Medication } from "@/lib/metabolic";
import { previewMedicationInteraction } from "@/lib/metabolic";

/** High-contrast safety copy — no enzyme or pathway jargon. */
export const SAFETY_OVERLAP_NOTE =
  "⚠️ Safety Note: This may overlap with your other meds. Please mention to your specialist.";

/** @deprecated Use SAFETY_OVERLAP_NOTE */
export const METABOLIC_CAUTION_MESSAGE = SAFETY_OVERLAP_NOTE;

type AuditRow = {
  aliases: string[];
} & Pick<
  Medication,
  | "pathway"
  | "is_inhibitor"
  | "is_substrate"
  | "has_orthostatic_hypotension"
  | "has_dizziness_side_effect"
  | "pathway_role"
>;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Silent automapping from medication names to metabolic pathways for doctor-facing
 * reports and interaction checks; not shown in the simplified Meds UI.
 */
const MED_NAME_AUDIT_ROWS: AuditRow[] = [
  {
    aliases: ["gleevec", "imatinib"],
    pathway: "CYP3A4",
    is_inhibitor: false,
    is_substrate: true,
    pathway_role: "Imatinib — CYP3A4 substrate",
    has_orthostatic_hypotension: true,
  },
  {
    aliases: ["latuda", "lurasidone"],
    pathway: "CYP3A4",
    is_inhibitor: false,
    is_substrate: true,
    pathway_role: "Lurasidone — CYP3A4 substrate",
  },
  {
    aliases: ["buspirone"],
    pathway: "CYP3A4",
    is_inhibitor: false,
    is_substrate: true,
    pathway_role: "Buspirone — CYP3A4 substrate",
  },
  {
    aliases: ["pregabalin", "lyrica"],
    pathway: "Renal (Kidneys)",
    is_inhibitor: false,
    is_substrate: false,
    pathway_role: "Primarily renal elimination",
  },
  {
    aliases: ["estradiol", "estrogen"],
    pathway: "UGT1A1",
    is_inhibitor: false,
    is_substrate: true,
  },
  {
    aliases: ["trazodone"],
    pathway: "CYP3A4",
    is_inhibitor: false,
    is_substrate: true,
    has_orthostatic_hypotension: true,
    has_dizziness_side_effect: true,
  },
  {
    aliases: ["magnesium"],
    pathway: "Other / Unknown",
    is_inhibitor: false,
    is_substrate: false,
  },
  {
    aliases: ["midodrine"],
    pathway: "Other / Unknown",
    is_inhibitor: false,
    is_substrate: false,
    has_orthostatic_hypotension: true,
  },
  {
    aliases: ["duloxetine", "cymbalta"],
    pathway: "CYP2D6",
    is_inhibitor: false,
    is_substrate: true,
  },
  {
    aliases: ["methylphenidate", "ritalin", "concerta"],
    pathway: "CYP2D6",
    is_inhibitor: false,
    is_substrate: true,
  },
  {
    aliases: ["thermotabs", "sodium chloride"],
    pathway: "Other / Unknown",
    is_inhibitor: false,
    is_substrate: false,
  },
  {
    aliases: ["methocarbamol", "robaxin"],
    pathway: "CYP2C19",
    is_inhibitor: false,
    is_substrate: true,
    has_dizziness_side_effect: true,
  },
  {
    aliases: ["lorazepam", "ativan"],
    pathway: "UGT1A1",
    is_inhibitor: false,
    is_substrate: true,
    has_dizziness_side_effect: true,
  },
  {
    aliases: ["ondansetron", "zofran"],
    pathway: "CYP3A4",
    is_inhibitor: false,
    is_substrate: true,
  },
  {
    aliases: ["fluconazole"],
    pathway: "CYP3A4",
    is_inhibitor: true,
    is_substrate: false,
    pathway_role: "Azole — strong CYP3A4 inhibition",
  },
  {
    aliases: ["itraconazole", "ketoconazole"],
    pathway: "CYP3A4",
    is_inhibitor: true,
    is_substrate: false,
    pathway_role: "Azole — CYP3A4 inhibition",
  },
  {
    aliases: ["clarithromycin"],
    pathway: "CYP3A4",
    is_inhibitor: true,
    is_substrate: false,
  },
  {
    aliases: ["verapamil", "diltiazem"],
    pathway: "CYP3A4",
    is_inhibitor: true,
    is_substrate: true,
    pathway_role: "Calcium channel blocker — CYP3A4 modulator",
  },
  {
    aliases: ["grapefruit"],
    pathway: "CYP3A4",
    is_inhibitor: true,
    is_substrate: false,
    pathway_role: "Food/beverage — intestinal CYP3A4 inhibition",
  },
];

function nameMatchesAlias(key: string, alias: string): boolean {
  const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i");
  return pattern.test(key);
}

function matchRow(name: string): AuditRow | null {
  const key = norm(name);
  if (!key) return null;
  for (const row of MED_NAME_AUDIT_ROWS) {
    if (row.aliases.some((a) => nameMatchesAlias(key, a))) return row;
  }
  return null;
}

/** Full metabolic profile for storage and clinician views — defaults when unknown. */
export function resolveAuditedMedication(name: string): Medication {
  const trimmed = name.trim();
  const row = matchRow(trimmed);
  const base: Medication = {
    name: trimmed,
    pathway: "Other / Unknown",
    is_inhibitor: false,
    is_substrate: false,
  };
  if (!row) return base;
  return {
    ...base,
    pathway: row.pathway,
    is_inhibitor: row.is_inhibitor,
    is_substrate: row.is_substrate,
    has_orthostatic_hypotension: row.has_orthostatic_hypotension,
    has_dizziness_side_effect: row.has_dizziness_side_effect,
    pathway_role: row.pathway_role,
  };
}

/** True when background rules flag overlap with existing meds (clinician-grade check). */
export function shouldWarnMetabolicOverlap(
  draft: Medication,
  currentMeds: Medication[],
): boolean {
  const r = previewMedicationInteraction(draft, currentMeds);
  return !r.isSafe;
}
