/** Matrix buckets — stored in `symptom_logs.category`. */
export type SymptomMatrixCategoryId =
  | "dysautonomia"
  | "mcas"
  | "autoimmune_sjogrens"
  | "fibromyalgia"
  | "general";

/** Four disorder toggles on the home screen (`general` is priority-only, not a pillar). */
export type SymptomMatrixPillarId = Exclude<SymptomMatrixCategoryId, "general">;

export const SYMPTOM_MATRIX_PILLAR_IDS: SymptomMatrixPillarId[] = [
  "dysautonomia",
  "mcas",
  "autoimmune_sjogrens",
  "fibromyalgia",
];

/** All valid DB category values (pillars + general). */
export const SYMPTOM_MATRIX_CATEGORY_IDS: SymptomMatrixCategoryId[] = [
  ...SYMPTOM_MATRIX_PILLAR_IDS,
  "general",
];

export const SYMPTOM_MATRIX_CATEGORY_LABEL: Record<
  SymptomMatrixCategoryId,
  string
> = {
  dysautonomia: "Dysautonomia",
  mcas: "MCAS",
  autoimmune_sjogrens: "Autoimmune / Sjögren's",
  fibromyalgia: "Fibromyalgia",
  general: "General",
};

/** Short labels for “Today’s totals” and compact summaries. */
export const SYMPTOM_MATRIX_CATEGORY_SHORT: Record<
  SymptomMatrixCategoryId,
  string
> = {
  dysautonomia: "Dysautonomia",
  mcas: "MCAS",
  autoimmune_sjogrens: "Sjögren's",
  fibromyalgia: "Fibro",
  general: "General",
};

export const GENERAL_CATEGORY_ID: SymptomMatrixCategoryId = "general";
export const GENERAL_FATIGUE_LABEL = "Fatigue";

export const BLURRY_VISION_LABEL = "Blurry vision";

/** Fibromyalgia quick-taps — must match UI strings for logging & trends. */
export const FIBRO_ALL_OVER_PAIN = "All-over Pain";
export const FIBRO_TENDER_POINTS = "Tender Points";
export const FIBRO_FOG = "Fibro Fog";
export const FIBRO_RESTLESS_SLEEP = "Restless Sleep";
export const FIBRO_STIFFNESS = "Stiffness";

export const FIBRO_PAIN_SYMPTOMS: readonly string[] = [
  FIBRO_ALL_OVER_PAIN,
  FIBRO_TENDER_POINTS,
];

/** Quick-tap symptoms per pillar (`symptom_logs.symptom_name`). */
export const SYMPTOM_MATRIX_GRID: Record<
  SymptomMatrixPillarId,
  readonly string[]
> = {
  dysautonomia: [
    "Brain fog",
    "Dizziness",
    "Lightheadedness",
    "Heart racing",
    "Nausea",
    "Heat intolerance",
    "Cold hands / feet",
    "Chest discomfort",
  ],
  mcas: [
    "Flushing",
    "Itching",
    "Hives",
    "GI flare",
    "Nasal congestion",
    "Shortness of breath",
    "Head pressure",
    "Brain fog",
  ],
  autoimmune_sjogrens: [
    "Dry eyes",
    "Dry mouth",
    "Joint pain",
    "Fatigue",
    "Brain fog",
    "Raynaud's",
    "Salivary swelling",
    "Sun sensitivity",
  ],
  fibromyalgia: [
    FIBRO_ALL_OVER_PAIN,
    FIBRO_TENDER_POINTS,
    FIBRO_FOG,
    FIBRO_RESTLESS_SLEEP,
    FIBRO_STIFFNESS,
  ],
};

export function isCognitiveFogSymptom(label: string): boolean {
  const s = label.trim().toLowerCase();
  return s === "brain fog" || s === "fibro fog";
}
