import type { OrthostaticSession } from "@/lib/types";

/** Resolve the 3-minute standing reading for legacy rows that only stored `standing`. */
export function standing3mReading(
  o: OrthostaticSession
): { systolic: number; diastolic: number } | undefined {
  return o.standing3m ?? o.standing;
}
