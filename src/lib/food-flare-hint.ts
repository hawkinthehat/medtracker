import type { BrainFogEntry, DailyLogEntry, MoodEntry } from "@/lib/types";

const WINDOW_MS = 4 * 60 * 60 * 1000;
const HIGH_FOG_MIN = 8;
/** Tip only if a linked flare happened within this many days (approx. “last week”). */
const LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

function normMeal(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function hadFlareInWindow(
  foodTime: number,
  moods: MoodEntry[],
  fog: BrainFogEntry[],
): boolean {
  const end = foodTime + WINDOW_MS;
  const moodHit = moods.some((m) => {
    const t = new Date(m.recordedAt).getTime();
    return t > foodTime && t <= end && m.mood === 1;
  });
  const fogHit = fog.some((f) => {
    const t = new Date(f.recordedAt).getTime();
    return t > foodTime && t <= end && f.score >= HIGH_FOG_MIN;
  });
  return moodHit || fogHit;
}

/**
 * True if this meal label was followed within 4h by crisis mood or high fog,
 * for an occurrence in the recent past (default ~2 weeks).
 */
export function mealLinkedToRecentFlare(
  mealLabel: string,
  dailyLogs: DailyLogEntry[],
  moods: MoodEntry[],
  brainFog: BrainFogEntry[],
): boolean {
  const target = normMeal(mealLabel);
  if (!target) return false;
  const now = Date.now();
  const foods = dailyLogs
    .filter((l) => l.category === "food" && normMeal(l.label) === target)
    .map((l) => ({ ...l, t: new Date(l.recordedAt).getTime() }))
    .filter((l) => now - l.t <= LOOKBACK_MS)
    .sort((a, b) => b.t - a.t);

  for (const f of foods) {
    if (hadFlareInWindow(f.t, moods, brainFog)) return true;
  }
  return false;
}
