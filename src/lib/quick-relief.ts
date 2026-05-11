import { formatDoseLabel } from "@/lib/medication-profile-types";
import type { MedicationProfile } from "@/lib/medication-profile-types";
import { defaultDoseMgForMedicationName } from "@/lib/medication-dose-defaults";
import type { PainMapSymptomCategory, SymptomBodyPartId } from "@/lib/symptom-map";
import {
  JOURNAL_PAIN_CATEGORIES,
  SYMPTOM_BODY_LABELS,
  SYMPTOM_TOGGLE_GROUPS,
} from "@/lib/symptom-map";
import type { SavedMedication } from "@/lib/seed-medications";

export type QuickReliefPeriod = "AM" | "PM";

export type QuickReliefDef = {
  displayName: string;
  /** Match against `SavedMedication.name` (lowercase). */
  matchNames: readonly string[];
  /** When the med is not on the master list or has no dose label. */
  fallbackDoseLabel: string;
  /** Tailwind gradient classes for the button face. */
  gradientClass: string;
  /** Ring / border accent. */
  ringClass: string;
};

export const QUICK_RELIEF_DEFS: readonly QuickReliefDef[] = [
  {
    displayName: "Excedrin",
    matchNames: ["excedrin"],
    fallbackDoseLabel: "2 caplets (per label)",
    gradientClass: "from-rose-500 via-red-500 to-orange-500",
    ringClass: "ring-rose-300",
  },
  {
    displayName: "Methocarbamol",
    matchNames: ["methocarbamol"],
    fallbackDoseLabel: "750 mg",
    gradientClass: "from-violet-600 to-indigo-700",
    ringClass: "ring-violet-300",
  },
  {
    displayName: "Lorazepam",
    matchNames: ["lorazepam"],
    fallbackDoseLabel: "0.5 mg",
    gradientClass: "from-sky-500 to-blue-700",
    ringClass: "ring-sky-300",
  },
  {
    displayName: "Ondansetron",
    matchNames: ["ondansetron", "zofran"],
    fallbackDoseLabel: "4 mg",
    gradientClass: "from-emerald-500 to-teal-700",
    ringClass: "ring-emerald-300",
  },
  {
    displayName: "Thermotabs",
    matchNames: ["thermotabs"],
    fallbackDoseLabel: "1 tablet (~360 mg sodium)",
    gradientClass: "from-amber-400 via-orange-500 to-slate-700",
    ringClass: "ring-amber-300",
  },
] as const;

function norm(s: string) {
  return s.trim().toLowerCase();
}

/** If `medicationName` matches a quick-relief definition, return its display label for reporting. */
export function quickReliefDisplayNameForLoggedMedication(
  medicationName: string,
): string | null {
  const n = norm(medicationName);
  for (const def of QUICK_RELIEF_DEFS) {
    if (norm(def.displayName) === n) return def.displayName;
    if (def.matchNames.some((m) => n === norm(m) || n.includes(norm(m)))) {
      return def.displayName;
    }
  }
  return null;
}

export function findSavedMedForQuickRelief(
  def: QuickReliefDef,
  medications: SavedMedication[],
): SavedMedication | undefined {
  const set = new Set(def.matchNames.map(norm));
  return medications.find((m) => set.has(norm(m.name)));
}

export function resolveQuickReliefDosageLabel(
  def: QuickReliefDef,
  medications: SavedMedication[],
  profiles: Record<string, MedicationProfile | undefined>,
): string {
  const med = findSavedMedForQuickRelief(def, medications);
  if (!med) return def.fallbackDoseLabel;
  const p = profiles[med.id];
  if (p) return formatDoseLabel(p.doseValue, p.doseUnit);
  if (med.doseLabel?.trim()) return med.doseLabel.trim();
  const mg = defaultDoseMgForMedicationName(med.name);
  return formatDoseLabel(mg, "mg");
}

export function clockPeriod(now = new Date()): QuickReliefPeriod {
  return now.getHours() < 12 ? "AM" : "PM";
}

const CATEGORY_LABELS: Partial<Record<PainMapSymptomCategory, string>> = {
  mcas_rash: "MCAS rash",
};

for (const g of Object.values(SYMPTOM_TOGGLE_GROUPS)) {
  for (const t of g.toggles) {
    CATEGORY_LABELS[t.category] = t.label;
  }
}
for (const j of JOURNAL_PAIN_CATEGORIES) {
  CATEGORY_LABELS[j.category] = j.label;
}

function painCategoryLabel(category: PainMapSymptomCategory): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, " ");
}

export function isSymptomBodyPartId(s: string): s is SymptomBodyPartId {
  return Object.prototype.hasOwnProperty.call(SYMPTOM_BODY_LABELS, s);
}

export function buildQuickReliefPainLinkSummary(
  medicationDisplayName: string,
  bodyPartId: SymptomBodyPartId,
  category: PainMapSymptomCategory,
  intensity?: number | null,
): string {
  const region = SYMPTOM_BODY_LABELS[bodyPartId];
  const sensation = painCategoryLabel(category);
  const inten =
    intensity != null && Number.isFinite(intensity)
      ? ` (intensity ${Math.round(intensity)}/10)`
      : "";
  return `Patient took ${medicationDisplayName} specifically for ${region} — ${sensation}${inten} marked on the map.`;
}
