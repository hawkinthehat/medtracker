import { fetchDailyLogsFromSupabase } from "@/lib/supabase/daily-logs";
import type { DailyLogEntry } from "@/lib/types";

/** Shared React Query fetcher for `qk.dailyLogs` — loads from Supabase when configured. */
export async function dailyLogsQueryFn(): Promise<DailyLogEntry[]> {
  return fetchDailyLogsFromSupabase();
}
