import type { SavedMedication } from "@/lib/seed-medications";
import type { ScheduledDose } from "@/lib/medication-schedule";

export type RecentDoseContext = {
  medicationId: string;
  medicationName: string;
  /** Fractional hours between dose time and now */
  hoursAgo: number;
};

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * Finds a dose time today in the past that best explains a symptom ~2h after dosing.
 * Uses scheduled start minutes for today’s calendar date (local).
 */
export function findRecentDoseContext(
  doses: ScheduledDose[],
  medications: SavedMedication[],
  now: Date = new Date()
): RecentDoseContext | null {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const nowMs = now.getTime();

  type Cand = { medicationId: string; medicationName: string; atMs: number };
  const candidates: Cand[] = [];

  const nowMin = minutesSinceMidnight(now);

  for (const d of doses) {
    let doseAt = new Date(startOfDay.getTime() + d.startMinute * 60 * 1000);
    // If schedule minute is later than clock today, treat as yesterday's same clock time
    if (d.startMinute > nowMin + 1) {
      doseAt = new Date(doseAt.getTime() - 24 * 60 * 60 * 1000);
    }
    const atMs = doseAt.getTime();
    if (atMs > nowMs) continue;

    const deltaMin = (nowMs - atMs) / (60 * 1000);
    if (deltaMin < 20) continue;
    if (deltaMin > 6 * 60) continue;

    const med = medications.find(
      (m) =>
        m.name.trim().toLowerCase() === d.medicationName.trim().toLowerCase()
    );
    candidates.push({
      medicationId: med?.id ?? `name:${d.medicationName}`,
      medicationName: d.medicationName.trim(),
      atMs,
    });
  }

  if (candidates.length === 0) return null;

  const targetMin = 120;
  candidates.sort(
    (a, b) =>
      Math.abs((nowMs - a.atMs) / 60000 - targetMin) -
      Math.abs((nowMs - b.atMs) / 60000 - targetMin)
  );

  const best = candidates[0];
  const hoursAgo = (nowMs - best.atMs) / (60 * 60 * 1000);

  return {
    medicationId: best.medicationId,
    medicationName: best.medicationName,
    hoursAgo,
  };
}

export function formatRoughHoursAgo(hours: number): string {
  if (hours < 1) {
    const m = Math.max(1, Math.round(hours * 60));
    return `${m} minute${m === 1 ? "" : "s"}`;
  }
  const rounded = Math.round(hours);
  if (Math.abs(hours - rounded) < 0.2) {
    return `${rounded} hour${rounded === 1 ? "" : "s"}`;
  }
  const oneDecimal = Math.round(hours * 10) / 10;
  return `${oneDecimal} hours`;
}
