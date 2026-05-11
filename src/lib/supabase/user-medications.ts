import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { SavedMedication } from "@/lib/seed-medications";

/**
 * Upserts one saved medication for the signed-in user (`user_medications`).
 * No-op when Supabase is missing or the user is anonymous.
 */
export async function upsertUserMedicationRemote(
  med: SavedMedication,
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return true;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return true;
  const { error } = await sb.from("user_medications").upsert(
    {
      user_id: user.id,
      id: med.id,
      payload: med as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,id" },
  );
  if (error) {
    console.warn("user_medications upsert:", error.message);
    return false;
  }
  return true;
}

/** Deletes a row for the signed-in user. No-op when not authenticated. */
export async function deleteUserMedicationRemote(
  medicationId: string,
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return true;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return true;
  const { error } = await sb
    .from("user_medications")
    .delete()
    .eq("user_id", user.id)
    .eq("id", medicationId);
  if (error) {
    console.warn("user_medications delete:", error.message);
    return false;
  }
  return true;
}
