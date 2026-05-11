import type { OrthostaticSession } from "@/lib/types";

/** Resolve the primary “standing phase” reading for charts and PDFs. */
export function standing3mReading(
  o: OrthostaticSession
): { systolic: number; diastolic: number } | undefined {
  return o.standing10m ?? o.standing3m ?? o.standing;
}
