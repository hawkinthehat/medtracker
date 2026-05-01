export type Medication = {
  name: string;
  pathway: string;
  is_inhibitor: boolean;
  is_substrate: boolean;
  /** Medications whose labeling commonly includes orthostatic hypotension risk. */
  has_orthostatic_hypotension?: boolean;
  /** Dizziness on labeling — bundled with OH for cumulative positional-risk screening. */
  has_dizziness_side_effect?: boolean;
  /** Short pathway / enzyme role line for UI (optional). */
  pathway_role?: string;
};

/** Med counts once toward cumulative positional risk if either flag is set. */
export function countsTowardPositionalCumulativeRisk(m: Medication): boolean {
  return (
    m.has_orthostatic_hypotension === true ||
    m.has_dizziness_side_effect === true
  );
}

export type PathwayInhibitorConflict = {
  pathway: string;
  inhibitor: string;
  substrate: string;
};

/**
 * Inhibitor on pathway P while another distinct medication is a substrate on P.
 */
export function findPathwayInhibitorSubstrateConflicts(
  meds: Medication[]
): PathwayInhibitorConflict[] {
  const seen = new Set<string>();
  const out: PathwayInhibitorConflict[] = [];

  for (let i = 0; i < meds.length; i++) {
    for (let j = 0; j < meds.length; j++) {
      if (i === j) continue;
      const inhibitorMed = meds[i];
      const substrateMed = meds[j];
      if (
        inhibitorMed.is_inhibitor &&
        substrateMed.is_substrate &&
        inhibitorMed.pathway === substrateMed.pathway
      ) {
        const key = `${inhibitorMed.pathway}|${inhibitorMed.name}|${substrateMed.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          pathway: inhibitorMed.pathway,
          inhibitor: inhibitorMed.name,
          substrate: substrateMed.name,
        });
      }
    }
  }
  return out;
}

/** More than three meds with OH and/or dizziness labeling → high cumulative risk copy. */
export function checkOHCumulativeRisk(meds: Medication[]): string | null {
  const n = meds.filter(countsTowardPositionalCumulativeRisk).length;
  if (n > 3) {
    return "High Cumulative Risk for Fainting - Use extra caution during positional changes.";
  }
  return null;
}

export interface InteractionCheck {
  isSafe: boolean;
  severity: "NONE" | "RED_ALERT";
  message: string;
}

export const PRIMARY_PATHWAYS = [
  "CYP3A4",
  "CYP2D6",
  "CYP2C19",
  "CYP2C9",
  "CYP1A2",
  "UGT1A1",
  "Renal (Kidneys)",
  "Other / Unknown",
] as const;

/** Two or more meds with orthostatic hypotension labeling → additive BP / syncope concern. */
const ORTHOSTATIC_ADDITIVE_MIN_COUNT = 2;

export const checkOrthostaticHypotensionAdditive = (
  meds: Medication[]
): string | null => {
  const count = meds.filter((m) => m.has_orthostatic_hypotension === true)
    .length;
  if (count >= ORTHOSTATIC_ADDITIVE_MIN_COUNT) {
    return "Caution: Combined medications may increase fainting risk today.";
  }
  return null;
};

export const checkMetabolicConflict = (
  newMed: Medication,
  currentMeds: Medication[]
): InteractionCheck => {
  const conflict = currentMeds.find(
    (med) =>
      med.pathway === newMed.pathway &&
      newMed.is_inhibitor &&
      med.is_substrate
  );

  if (conflict) {
    return {
      isSafe: false,
      severity: "RED_ALERT",
      message: `CRITICAL INTERACTION: ${newMed.name} is an inhibitor of the ${newMed.pathway} pathway. This will cause ${conflict.name} levels to spike dangerously in the bloodstream, increasing the risk of toxicity (e.g., the metabolic bottleneck recently experienced).`,
    };
  }

  return {
    isSafe: true,
    severity: "NONE",
    message: "No immediate metabolic bottleneck detected.",
  };
};

/** Live Smart Add preview: CYP3A4 inhibitor vs substrates already on the list. */
export function getCyp3a4BottleneckHint(
  newMed: Medication,
  currentMeds: Medication[]
): string | null {
  if (newMed.pathway !== "CYP3A4" || !newMed.name.trim()) return null;
  const check = checkMetabolicConflict(newMed, currentMeds);
  if (!check.isSafe && check.severity === "RED_ALERT") return check.message;
  return null;
}

const SUBSTRATE_LABEL_NAMES = ["Gleevec", "Latuda"] as const;

function normalizeDrug(n: string): string {
  return n.trim().toLowerCase();
}

/**
 * When increasing an inhibitor's dose, warn if CYP3A4 substrates imatinib/lurasidone
 * are on the list — stronger inhibition slows their clearance.
 */
export function warnInhibitorDoseEscalation(
  med: Medication,
  previousMg: number | undefined,
  nextMg: number,
  currentMeds: Medication[]
): string | null {
  if (!med.is_inhibitor) return null;
  const prev = previousMg ?? 0;
  if (nextMg <= prev) return null;

  const hasRiskSubstrate = currentMeds.some((m) =>
    SUBSTRATE_LABEL_NAMES.some(
      (label) => normalizeDrug(m.name) === normalizeDrug(label)
    )
  );
  if (!hasRiskSubstrate) return null;

  return "Higher dose detected—this will further slow the clearance of Gleevec/Latuda.";
}
