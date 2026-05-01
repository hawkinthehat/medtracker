import type { ScheduledDose } from "@/lib/medication-schedule";
import { normalizeMedName } from "@/lib/medication-schedule";
import type { SavedMedication } from "@/lib/seed-medications";

export type LikelyContributorFlag = {
  kind: "likely_contributor";
  drugs: string[];
  note: string;
};

export type MetabolicBottleneckFlag = {
  kind: "metabolic_bottleneck";
  inhibitors: string[];
  note: string;
};

export type SideEffectAuditFlag =
  | LikelyContributorFlag
  | MetabolicBottleneckFlag;

export type ProbabilityCard = {
  drugName: string;
  pathwayLine: string;
};

const DIZZY_TARGETS = new Set(["duloxetine", "trazodone"]);

function pathwayDescriptor(m: SavedMedication): string {
  if (m.pathway_role?.trim()) return m.pathway_role.trim();
  const bits: string[] = [];
  if (m.pathway) bits.push(`${m.pathway} pathway`);
  if (m.has_orthostatic_hypotension) bits.push("orthostatic risk on labeling");
  if (m.has_dizziness_side_effect) bits.push("dizziness on labeling");
  return bits.length ? bits.join("; ") : "documented side-effect profile";
}

export function normalizeSymptomInput(raw: string): string {
  return raw.trim().toLowerCase();
}

export function matchesDizziness(symptom: string): boolean {
  const s = normalizeSymptomInput(symptom);
  return s === "dizziness" || s.includes("dizz");
}

export function matchesVomitingVitalsCrash(symptom: string): boolean {
  const s = normalizeSymptomInput(symptom);
  if (!s) return false;
  return (
    s.includes("vomit") ||
    s.includes("vitals crash") ||
    s.includes("vitals/crash") ||
    (s.includes("crash") && s.includes("vital"))
  );
}

/** Map dose rows to meds; inhibitors with at least one scheduled dose today count as “on today’s calendar.” */
export function inhibitorsPresentOnTimeline(
  medications: SavedMedication[],
  doses: ScheduledDose[]
): string[] {
  const byNorm = new Map(
    medications.map((m) => [normalizeMedName(m.name), m] as const)
  );
  const out = new Set<string>();
  for (const d of doses) {
    const m = byNorm.get(normalizeMedName(d.medicationName));
    if (m?.is_inhibitor) out.add(m.name);
  }
  return Array.from(out);
}

/**
 * If the timeline is empty, fall back to any inhibitor on the saved med list
 * (same source as the meds table cross-reference).
 */
export function inhibitorsForMetabolicCheck(
  medications: SavedMedication[],
  doses: ScheduledDose[]
): string[] {
  const fromTimeline = inhibitorsPresentOnTimeline(medications, doses);
  if (fromTimeline.length > 0) return fromTimeline;
  return medications.filter((m) => m.is_inhibitor).map((m) => m.name);
}

export function auditSideEffect(
  symptom: string,
  medications: SavedMedication[],
  doses: ScheduledDose[]
): { flags: SideEffectAuditFlag[]; probability: ProbabilityCard | null } {
  const flags: SideEffectAuditFlag[] = [];

  if (matchesDizziness(symptom)) {
    const contributors = medications.filter((m) =>
      DIZZY_TARGETS.has(normalizeMedName(m.name))
    );
    if (contributors.length > 0) {
      flags.push({
        kind: "likely_contributor",
        drugs: contributors.map((m) => m.name),
        note:
          "These meds are flagged as likely contributors: orthostatic and/or serotonergic effects overlap with dizziness.",
      });
    }
  }

  if (matchesVomitingVitalsCrash(symptom)) {
    const inhibitors = inhibitorsForMetabolicCheck(medications, doses);
    if (inhibitors.length > 0) {
      flags.push({
        kind: "metabolic_bottleneck",
        inhibitors,
        note:
          "A CYP inhibitor on board can raise levels of co-pathway substrates — worth reviewing timing vs nausea or collapse.",
      });
    }
  }

  const probability = buildProbabilityCard(symptom, medications, flags);
  return { flags, probability };
}

function pickPriorityMed(
  symptom: string,
  medications: SavedMedication[]
): SavedMedication | null {
  const byNorm = (n: string) =>
    medications.find((m) => normalizeMedName(m.name) === n) ?? null;

  if (matchesDizziness(symptom)) {
    return (
      byNorm("duloxetine") ??
      byNorm("trazodone") ??
      medications.find((m) =>
        DIZZY_TARGETS.has(normalizeMedName(m.name))
      ) ??
      null
    );
  }

  if (matchesVomitingVitalsCrash(symptom)) {
    const inh = medications.filter((m) => m.is_inhibitor);
    const flu = inh.find((m) => normalizeMedName(m.name) === "fluconazole");
    if (flu) return flu;
    return inh[0] ?? null;
  }

  const s = normalizeSymptomInput(symptom);
  if (s.includes("brain") || s.includes("fog")) {
    return (
      byNorm("trazodone") ??
      byNorm("lorazepam") ??
      medications.find((m) => m.has_orthostatic_hypotension) ??
      null
    );
  }
  if (s.includes("nausea")) {
    return byNorm("duloxetine") ?? byNorm("pregabalin") ?? null;
  }
  if (s.includes("numb")) {
    return byNorm("pregabalin") ?? null;
  }
  if (s.includes("flush")) {
    return byNorm("duloxetine") ?? medications[0] ?? null;
  }

  return medications[0] ?? null;
}

function buildProbabilityCard(
  symptom: string,
  medications: SavedMedication[],
  flags: SideEffectAuditFlag[]
): ProbabilityCard | null {
  if (!normalizeSymptomInput(symptom)) return null;

  const med = pickPriorityMed(symptom, medications);
  if (!med) {
    const bottleneck = flags.find((f) => f.kind === "metabolic_bottleneck");
    if (
      bottleneck &&
      bottleneck.kind === "metabolic_bottleneck" &&
      bottleneck.inhibitors.length
    ) {
      const name = bottleneck.inhibitors[0];
      return {
        drugName: name,
        pathwayLine:
          "CYP inhibition can bottleneck clearance of shared substrates — spike symptoms when levels rise.",
      };
    }
    return null;
  }

  return {
    drugName: med.name,
    pathwayLine: pathwayDescriptor(med),
  };
}
