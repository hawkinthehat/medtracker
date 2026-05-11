import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  requireAuthUserForSave,
  resolveSupabaseUserId,
} from "@/lib/supabase/auth-save-guard";

export async function fetchTodayActivityCountsForCurrentUser(): Promise<{
  dogWalks: number;
  ptSessions: number;
  hasSession: boolean;
}> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { dogWalks: 0, ptSessions: 0, hasSession: false };

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) return { dogWalks: 0, ptSessions: 0, hasSession: false };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data, error } = await sb
    .from("activity_logs")
    .select("activity_type")
    .eq("user_id", uid)
    .gte("recorded_at", start.toISOString())
    .lt("recorded_at", end.toISOString());

  if (error) {
    console.warn("[activity_logs] today counts:", error.message);
    return { dogWalks: 0, ptSessions: 0, hasSession: true };
  }

  let dogWalks = 0;
  let ptSessions = 0;
  for (const row of data ?? []) {
    const t = (row as { activity_type?: string }).activity_type;
    if (t === "dog_walk") dogWalks += 1;
    else if (t === "pt") ptSessions += 1;
  }

  return { dogWalks, ptSessions, hasSession: true };
}

/**
 * Inserts a row into activity_logs for the signed-in user.
 */
export async function insertActivityLogRow(input: {
  activity_type: string;
  notes?: string | null;
  recorded_at?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "no_client" };

  const authUser = await requireAuthUserForSave(sb);
  if (!authUser) {
    return { ok: false, error: "not_signed_in" };
  }
  const uid = authUser.id;

  const { error } = await sb.from("activity_logs").insert({
    activity_type: input.activity_type,
    notes: input.notes ?? null,
    recorded_at: input.recorded_at ?? new Date().toISOString(),
    user_id: uid,
  });

  if (error) {
    console.warn("[activity_logs] insert failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
