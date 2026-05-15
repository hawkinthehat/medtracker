import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  logDataNotSavedNoUser,
  resolveSupabaseUserId,
  withTimeoutMs,
} from "@/lib/supabase/auth-save-guard";
import { localCalendarDayRecordedAtBounds } from "@/lib/hydration-summary";
import { fetchTodayDailyLogsForCurrentUser } from "@/lib/supabase/daily-logs";
import {
  calendarDayLocal,
  countDogWalksToday,
} from "@/lib/movement-tracking";

/** Cached shape for `qk.activityToday` — matches {@link fetchTodayActivityCountsForCurrentUser}. */
export type ActivityTodayCounts = {
  dogWalks: number;
  ptSessions: number;
  morningMeds: number;
  /** Latest `recorded_at` among today’s `morning_meds` rows (ISO), if any. */
  morningMedsLastRecordedAt: string | null;
  hasSession: boolean;
};

export async function fetchTodayActivityCountsForCurrentUser(): Promise<ActivityTodayCounts> {
  const sb = getSupabaseBrowserClient();
  if (!sb) {
    return {
      dogWalks: 0,
      ptSessions: 0,
      morningMeds: 0,
      morningMedsLastRecordedAt: null,
      hasSession: false,
    };
  }

  const uid = await resolveSupabaseUserId(sb);
  if (!uid) {
    return {
      dogWalks: 0,
      ptSessions: 0,
      morningMeds: 0,
      morningMedsLastRecordedAt: null,
      hasSession: false,
    };
  }

  const { startIso, endIso } = localCalendarDayRecordedAtBounds();

  const { data, error } = await sb
    .from("activity_logs")
    .select("activity_type, recorded_at")
    .eq("user_id", uid)
    .gte("recorded_at", startIso)
    .lt("recorded_at", endIso);

  if (error) {
    console.warn("[activity_logs] today counts:", error.message);
    return {
      dogWalks: 0,
      ptSessions: 0,
      morningMeds: 0,
      morningMedsLastRecordedAt: null,
      hasSession: true,
    };
  }

  let dogWalks = 0;
  let ptSessions = 0;
  let morningMeds = 0;
  let morningMedsLastRecordedAt: string | null = null;
  for (const row of data ?? []) {
    const r = row as { activity_type?: string; recorded_at?: string };
    const t = r.activity_type;
    const ra = r.recorded_at;
    if (t === "dog_walk") dogWalks += 1;
    else if (t === "pt") ptSessions += 1;
    else if (t === "morning_meds") {
      morningMeds += 1;
      if (ra && (!morningMedsLastRecordedAt || ra > morningMedsLastRecordedAt)) {
        morningMedsLastRecordedAt = ra;
      }
    }
  }

  try {
    const todayDaily = await fetchTodayDailyLogsForCurrentUser();
    if (todayDaily.hasSession && todayDaily.entries.length > 0) {
      dogWalks += countDogWalksToday(
        todayDaily.entries,
        calendarDayLocal(),
      );
    }
  } catch (e) {
    console.warn("[activity_logs] merge dog walks from daily_logs:", e);
  }

  return {
    dogWalks,
    ptSessions,
    morningMeds,
    morningMedsLastRecordedAt,
    hasSession: true,
  };
}

/** Dog walks today from `activity_logs` (`activity_type = dog_walk`). */
export async function fetchTodayDogWalkCountForCurrentUser(): Promise<{
  count: number;
  hasSession: boolean;
}> {
  const r = await fetchTodayActivityCountsForCurrentUser();
  return { count: r.dogWalks, hasSession: r.hasSession };
}

/**
 * Inserts a row into activity_logs for the signed-in user.
 */
export async function insertActivityLogRow(input: {
  activity_type: string;
  notes?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "no_client" };

  function isJwtLikeInsertFailure(err: {
    message: string;
    code?: string;
  }): boolean {
    const m = `${err.message} ${err.code ?? ""}`.toLowerCase();
    return (
      m.includes("jwt") ||
      m.includes("expired") ||
      m.includes("401") ||
      m.includes("pgrst301")
    );
  }

  try {
    const uid = await withTimeoutMs(resolveSupabaseUserId(sb), 12_000);
    if (!uid) {
      logDataNotSavedNoUser();
      return { ok: false, error: "not_signed_in" };
    }

    const recorded_at = new Date().toISOString();
    const payload = {
      activity_type: input.activity_type,
      notes: input.notes ?? null,
      recorded_at,
      user_id: uid,
    };

    const runInsert = async () => {
      const { error } = await sb.from("activity_logs").insert(payload);
      return { error };
    };

    let insertRes = await withTimeoutMs(
      runInsert(),
      22_000,
      "Activity save timed out — check your connection.",
    );
    if (insertRes.error && isJwtLikeInsertFailure(insertRes.error)) {
      await sb.auth.refreshSession();
      insertRes = await withTimeoutMs(
        runInsert(),
        22_000,
        "Activity save timed out — check your connection.",
      );
    }

    const error = insertRes.error;

    if (error) {
      console.warn("[activity_logs] insert failed:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[activity_logs] insert:", message);
    return { ok: false, error: message };
  }
}
