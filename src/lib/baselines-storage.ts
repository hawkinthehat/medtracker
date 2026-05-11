import {
  DEFAULT_SODIUM_GOAL_MG,
  DEFAULT_WATER_GOAL_OZ,
} from "@/lib/hydration-summary";

export const BASELINES_LS = "tiaki-baselines-v1";
export const BASELINES_COMPLETE_LS = "tiaki-baselines-complete-v1";
export const WELCOME_WIZARD_LS = "tiaki-welcome-wizard-v1";

export type BaselinesProfile = {
  targetWaterOz: number;
  targetSodiumMg: number;
  typicalSymptoms: string[];
};

const DEFAULT_PROFILE: BaselinesProfile = {
  targetWaterOz: DEFAULT_WATER_GOAL_OZ,
  targetSodiumMg: DEFAULT_SODIUM_GOAL_MG,
  typicalSymptoms: [],
};

export const TYPICAL_SYMPTOM_OPTIONS = [
  "Fatigue",
  "Dizziness",
  "Brain fog",
  "Nausea",
  "Palpitations / racing heart",
  "Headache",
  "Shortness of breath",
  "GI upset",
] as const;

export function loadBaselines(): BaselinesProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(BASELINES_LS);
    if (!raw) return DEFAULT_PROFILE;
    const p = JSON.parse(raw) as Partial<BaselinesProfile>;
    return {
      targetWaterOz:
        typeof p.targetWaterOz === "number" &&
        Number.isFinite(p.targetWaterOz) &&
        p.targetWaterOz > 0
          ? Math.round(p.targetWaterOz)
          : DEFAULT_WATER_GOAL_OZ,
      targetSodiumMg:
        typeof p.targetSodiumMg === "number" &&
        Number.isFinite(p.targetSodiumMg) &&
        p.targetSodiumMg > 0
          ? Math.round(p.targetSodiumMg)
          : DEFAULT_SODIUM_GOAL_MG,
      typicalSymptoms: Array.isArray(p.typicalSymptoms)
        ? p.typicalSymptoms.filter((s) => typeof s === "string")
        : [],
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveBaselines(profile: BaselinesProfile): void {
  try {
    window.localStorage.setItem(BASELINES_LS, JSON.stringify(profile));
    window.localStorage.setItem(BASELINES_COMPLETE_LS, "1");
    window.dispatchEvent(new Event("tiaki-baselines-updated"));
  } catch {
    /* ignore */
  }
}

export function isBaselinesComplete(): boolean {
  try {
    return window.localStorage.getItem(BASELINES_COMPLETE_LS) === "1";
  } catch {
    return false;
  }
}

export function isWelcomeWizardComplete(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_WIZARD_LS) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeWizardComplete(): void {
  try {
    window.localStorage.setItem(WELCOME_WIZARD_LS, "1");
  } catch {
    /* ignore */
  }
}
