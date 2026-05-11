export const qk = {
  /** `v3`: positional-risk flags (OH + dizziness) on seed drugs. */
  medications: ["medications", "v3"] as const,
  vitals: ["vitals"] as const,
  swellingChecks: ["swellingChecks"] as const,
  orthostatic: ["orthostatic"] as const,
  journal: ["journal"] as const,
  dailyLogs: ["dailyLogs"] as const,
  specialistNotes: ["specialistNotes"] as const,
  /** Inhibitor/substrate gate blocks when adding a medication */
  safetyGateBlocks: ["safetyGateBlocks"] as const,
  /** Post-dose symptom rows for tolerability / specialist reports */
  sideEffectLogs: ["sideEffectLogs"] as const,
  /** Dose amount, unit, and scheduled times per medication id */
  medicationProfiles: ["medicationProfiles", "v2"] as const,
  /** Append-only dose/time changes (synced to Supabase medication_history) */
  medicationHistory: ["medicationHistory", "v1"] as const,
  /** Taper schedules keyed by medication id */
  taperPlans: ["taperPlans", "v1"] as const,
  /** Crisis / severe fog during an active taper — highlighted on dashboards */
  taperSensitivityEvents: ["taperSensitivityEvents", "v1"] as const,
  moods: ["moods"] as const,
  brainFog: ["brainFog"] as const,
  episodes: ["episodes"] as const,
  painSnapshots: ["painSnapshots"] as const,
  clinicalSnapshots: ["clinicalSnapshots"] as const,
  /** Supabase-backed medication times + merged demo fallback for the 24h timeline */
  medicationTimeline: ["medicationTimeline"] as const,
  /** OpenWeather 12h pressure-drop advisory (Tiaki) */
  weatherPressureAdvisory: ["weather", "pressureAdvisory", "v1"] as const,
  /** PRN quick-relief logs (`medication_logs`) */
  medicationLogs: ["medicationLogs", "v1"] as const,
  /** Symptom map rows per body region (`pain_map`) */
  painMap: (bodyPartId: string) => ["painMap", bodyPartId] as const,
  /** Distinct body_part_id values present in `pain_map` (for mapper highlights) */
  painMapActiveBodyParts: ["painMap", "activeBodyParts"] as const,
  /** Per-day Sjögren / sicca rows (`clinical_markers`) */
  clinicalMarkers: (dateKey: string) =>
    ["clinicalMarkers", dateKey] as const,
};
