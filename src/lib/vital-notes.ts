import type { VitalRow } from "@/lib/types";

/** Flattens VitalRow metadata into a single Supabase `notes` cell for clinicians. */
export function encodeVitalNotesForSupabase(
  row: Pick<VitalRow, "notes" | "compressionGarment" | "abdominalBinder">,
): string | null {
  const lines: string[] = [];
  if (row.notes?.trim()) lines.push(row.notes.trim());
  if (row.compressionGarment !== undefined) {
    lines.push(`Compression garment: ${row.compressionGarment ? "yes" : "no"}`);
  }
  if (row.abdominalBinder !== undefined) {
    lines.push(`Abdominal binder: ${row.abdominalBinder ? "yes" : "no"}`);
  }
  return lines.length ? lines.join("\n") : null;
}
