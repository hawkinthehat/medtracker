import type { EdemaLevelType } from "./edema-level-type";

export type { EdemaLevelType } from "./edema-level-type";

export type SwellingCheckEntry = {
  id: string;
  recordedAt: string;
  edemaLevel: EdemaLevelType;
  notes?: string;
};

export type VitalRow = {
  id: string;
  recordedAt: string;
  systolic: number;
  diastolic: number;
  heartRate?: number;
  notes?: string;
  /** Compression leggings/socks — encoded into Supabase `notes` for specialists. */
  compressionGarment?: boolean;
  abdominalBinder?: boolean;
};

/** BP reading with optional pulse — used in orthostatic sessions. */
export type BpHrReading = {
  systolic: number;
  diastolic: number;
  heartRate?: number;
};

export type OrthostaticSession = {
  id: string;
  recordedAt: string;
  lying: BpHrReading;
  sitting: BpHrReading;
  /** Standing BP at ~1 minute (after standing). */
  standing1m?: BpHrReading;
  /**
   * Standing BP at ~3 minutes — legacy; active stand test uses `standing10m` when set.
   */
  standing3m?: BpHrReading;
  /** Standing BP at ~10 minutes (active stand / poor man's tilt table). */
  standing10m?: BpHrReading;
  /** @deprecated prefer standing3m — retained for older localStorage snapshots */
  standing?: BpHrReading;
  /** Optional checklist from active stand test UI. */
  activeStandSymptoms?: string[];
  deltaSystolic: number;
  deltaDiastolic: number;
  positiveOrthostatic: boolean;
  /** Standing HR − lying HR > 30 (per common POTS screening cue). */
  potsSuspect?: boolean;
  /** Gear worn during the standing portion — shown on doctor report. */
  compressionGarment?: boolean;
  abdominalBinder?: boolean;
};

/** Where symptoms occurred — indoor vs outdoor for environmental correlation. */
export type JournalSetting = "indoor" | "outdoor" | "unspecified";

export type JournalEntry = {
  id: string;
  recordedAt: string;
  text: string;
  /** Indoor vs outdoor when this entry was logged; omit on legacy rows. */
  setting?: JournalSetting;
};

/** Daily activity / intake logs merged with the symptom journal on the Daily Summary. */
export type DailyLogCategory =
  | "food"
  | "hydration"
  | "sleep"
  | "activity"
  | "other";

export type DailyLogEntry = {
  id: string;
  recordedAt: string;
  category: DailyLogCategory;
  /** Short label, e.g. meal or activity name */
  label: string;
  notes?: string;
  /** Optional semantic tag (matches Supabase `entry_type`). */
  entryType?: string;
  /** Fluid ounces when logging water (`daily_logs.value`). */
  valueOz?: number;
  /** Owner when row was inserted authenticated (matches Supabase `user_id`). */
  userId?: string;
  /** Body symptom sketch (PNG base64, no data URL prefix) when saved from SymptomCanvas */
  sketchPngBase64?: string;
  sketchSide?: "front" | "back";
  sketchBrushPreset?: string;
};

export type SpecialistFacility = "KU Medical Center" | "WashU";

export type SpecialistNote = {
  id: string;
  facility: SpecialistFacility;
  specialist: string;
  recordedAt: string;
  notes: string;
};

/**
 * Logged after a dose: which symptoms showed up, for drug tolerability reporting.
 * Persisted via React Query (`qk.sideEffectLogs`).
 */
export type SideEffectLog = {
  id: string;
  recordedAt: string;
  medicationId: string;
  medicationName: string;
  /** e.g. "40 mg with dinner" — splits reporting by dose when set */
  doseLabel?: string;
  symptoms: string[];
  /** 1 = mild … 10 = severe */
  severity?: number;
};

/** Logged when Add medication is blocked: new inhibitor vs existing substrate on same pathway. */
export type SafetyGateBlockEvent = {
  id: string;
  recordedAt: string;
  pathway: string;
  draftInhibitorName: string;
  blockedSubstrateName: string;
};

/** Body regions for the pain map (front view). */
export type PainRegionId =
  | "head"
  | "neck"
  | "chest"
  | "abdomen"
  | "pelvis"
  | "leftArm"
  | "rightArm"
  | "leftLeg"
  | "rightLeg";

export type PainMapSnapshot = {
  id: string;
  recordedAt: string;
  regions: Partial<Record<PainRegionId, number>>;
};

export type MoodEntry = {
  id: string;
  recordedAt: string;
  /** 1 = lowest … 5 = highest */
  mood: 1 | 2 | 3 | 4 | 5;
  note?: string;
};

/** Cognitive fog score for transition / vault averages (1 = clearest … 10 = worst). */
export type BrainFogEntry = {
  id: string;
  recordedAt: string;
  score: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  note?: string;
};

export type EpisodeEntry = {
  id: string;
  recordedAt: string;
  description: string;
  painRegions?: Partial<Record<PainRegionId, number>>;
  compressionGarment?: boolean;
  abdominalBinder?: boolean;
};

/** Local nightly clinical correlation (9 PM engine); persisted via React Query. */
export type ClinicalCorrelationTrigger = "scheduled_21_00" | "manual_preview";

export type ClinicalCorrelationSnapshot = {
  /** Local calendar date YYYY-MM-DD summarized */
  dateKey: string;
  computedAt: string;
  trigger: ClinicalCorrelationTrigger;
  narratives: string[];
  locked: boolean;
  lockedAt?: string;
};

/** Map of dateKey → snapshot for quick lookup and PDF export. */
export type ClinicalSnapshotsMap = Record<string, ClinicalCorrelationSnapshot>;
