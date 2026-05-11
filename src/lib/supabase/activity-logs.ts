import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

/**
 * Inserts a row into activity_logs for the signed-in user.
 * Returns ok:false when Supabase is missing or the user session is absent (caller may still persist daily_logs).
 */
export async function insertActivityLogRow(input: {
  activity_type: string;
  notes?: string | null;
  recorded_at?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "no_client" };

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();
  if (userErr || !user) {
    return { ok: false, error: "not_signed_in" };
  }

  const { error } = await sb.from("activity_logs").insert({
    activity_type: input.activity_type,
    notes: input.notes ?? null,
    recorded_at: input.recorded_at ?? new Date().toISOString(),
    user_id: user.id,
  });

  if (error) {
    console.warn("[activity_logs] insert failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
