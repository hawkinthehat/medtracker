/** Short educational copy for success feedback (dysautonomia-aware, community-safe). */

export function toastWaterLogged(
  oz: number,
  opts?: { localOnly?: boolean },
): string {
  const base = `Water logged! (+${oz} oz) Staying hydrated helps maintain blood volume to fight OH symptoms.`;
  return opts?.localOnly ? `${base} (Saved on this device only.)` : base;
}

export const TOAST_ACTIVE_STAND =
  "Active stand saved! This data helps your doctor identify positional triggers.";

export const TOAST_SPOT_VITAL =
  "Vital saved! Home readings give your care team a clearer day-to-day picture.";

export const TOAST_SWELLING =
  "Swelling check saved! Tracking edema over time helps your team spot fluid shifts.";

export function toastPrnLogged(displayName: string, timeLabel: string): string {
  return `PRN logged: ${displayName} at ${timeLabel}. A clear PRN history makes titration and visits easier.`;
}

export const TOAST_ACTIVITY =
  "Activity logged! Current temperature is attached to help you see if heat affects stamina.";

export function toastPtLogged(humanLabel: string): string {
  return `${humanLabel} logged! Movement entries include weather context for pattern spotting.`;
}

export const TOAST_SIDE_EFFECT =
  "Side effect logged! Patterns over time help your care team adjust treatment safely.";

export function toastShowerCheck(feeling: string): string {
  return `Shower check-in saved (${feeling}). Hot water can worsen orthostatic symptoms — your note adds context.`;
}

export function toastFoodLogged(label: string): string {
  return `Meal logged: ${label}. Food timing helps link flares to meals and ingredients.`;
}

export const TOAST_MOOD =
  "Mood logged! Day-to-day trends help you and your doctor spot triggers.";

export const TOAST_BRAIN_FOG =
  "Brain fog logged! Tracking cognitive load alongside meds and sleep reveals patterns.";

export function toastLinkedMedication(name: string): string {
  return `Linked to ${name}. Pairing symptoms with recent doses sharpens your doctor report.`;
}

export const TOAST_MORNING_ROUTINE =
  "Morning routine saved! A consistent AM anchor makes the rest of your day easier to interpret.";

export const TOAST_JOURNAL_ENTRY =
  "Journal entry saved! Short notes build a timeline your specialists can scan.";

export const TOAST_DAILY_LOG =
  "Log added! One timeline helps your team connect food, meds, and symptoms.";

export const TOAST_SYMPTOM_MAP =
  "Body map saved! Visual symptom location helps clinicians compare visits.";
