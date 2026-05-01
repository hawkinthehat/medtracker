/**
 * PostgreSQL enum `edema_level_type` — keep values in sync with your Supabase
 * migration (order and literals must match).
 */
export const EDEMA_LEVEL_TYPE = [
  "none",
  "trace",
  "one_plus",
  "two_plus",
  "three_plus",
  "four_plus",
] as const;

export type EdemaLevelType = (typeof EDEMA_LEVEL_TYPE)[number];

/** Human-readable labels for radio UI */
export const EDEMA_LEVEL_TYPE_LABELS: Record<EdemaLevelType, string> = {
  none: "None",
  trace: "Trace",
  one_plus: "1+ (≤2 mm pit)",
  two_plus: "2+ (3–4 mm)",
  three_plus: "3+ (5–6 mm)",
  four_plus: "4+ (>6 mm)",
};
