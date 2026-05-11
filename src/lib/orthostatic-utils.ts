import type { BpHrReading, OrthostaticSession } from "@/lib/types";

/** Full standing-phase BP/HR when present (3m / 10m / legacy). */
export function standingPhaseReading(
  o: OrthostaticSession,
): BpHrReading | undefined {
  return o.standing10m ?? o.standing3m ?? o.standing;
}

/** Resolve the primary “standing phase” reading for charts and PDFs. */
export function standing3mReading(
  o: OrthostaticSession
): { systolic: number; diastolic: number } | undefined {
  return o.standing10m ?? o.standing3m ?? o.standing;
}
