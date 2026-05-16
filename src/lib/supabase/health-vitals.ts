import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { requireAuthUserForSave } from "@/lib/supabase/auth-save-guard";

export type HealthVitalPosition = "lying" | "sitting" | "standing";

export type InsertHealthVitalInput = {
  /** When set, used as row id so the client cache matches the insert. */
  id?: string;
  systolic: number;
  diastolic: number;
  position: HealthVitalPosition;
  heartRate?: number | null;
};

export async function insertHealthVital(
  input: InsertHealthVitalInput,
): Promise<
  { ok: true; id: string; recordedAt: string } | { ok: false; error: string }
> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "Supabase is not configured." };

  const authUser = await requireAuthUserForSave(sb);
  if (!authUser) return { ok: false, error: "not_signed_in" };

  const id = input.id ?? crypto.randomUUID();
  const recordedAt = new Date().toISOString();
  const hr =
    input.heartRate != null &&
    String(input.heartRate).trim() !== "" &&
    Number.isFinite(Number(input.heartRate))
      ? Math.round(Number(input.heartRate))
      : null;

  const { error } = await sb.from("health_vitals").insert({
    id,
    user_id: authUser.id,
    recorded_at: recordedAt,
    systolic: Math.round(Number(input.systolic)),
    diastolic: Math.round(Number(input.diastolic)),
    position: input.position,
    pulse: hr,
  });

  if (error) {
    console.warn("[health_vitals] insert:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, id, recordedAt };
}
