import type { QueryClient } from "@tanstack/react-query";
import type { DailyLogEntry } from "@/lib/types";
import { sumCaffeineMgToday } from "@/lib/caffeine-intake";
import {
  sumThermotabsSodiumMgTodayFromDailyLogs,
  sumWaterOzToday,
} from "@/lib/hydration-summary";
import { countDogWalksToday } from "@/lib/movement-tracking";
import { qk } from "@/lib/query-keys";
import { persistDailyLogToSupabaseNoTimeout } from "@/lib/supabase/daily-logs";

const VERSION = 1;

export function plannerDailyBackupKey(
  userId: string | undefined,
  dayKey: string,
): string {
  return `medtracker-planner-day-v${VERSION}:${userId ?? "anon"}:${dayKey}`;
}

export type PlannerDailyBackup = {
  waterOz: number;
  sodiumMg: number;
  caffeineMg: number;
  dogWalks: number;
  updatedAt: number;
};

export function readPlannerDailyBackup(
  userId: string | undefined,
  dayKey: string,
): PlannerDailyBackup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      plannerDailyBackupKey(userId, dayKey),
    );
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PlannerDailyBackup>;
    if (
      typeof p.waterOz !== "number" ||
      typeof p.sodiumMg !== "number" ||
      typeof p.caffeineMg !== "number" ||
      typeof p.dogWalks !== "number"
    ) {
      return null;
    }
    return {
      waterOz: p.waterOz,
      sodiumMg: p.sodiumMg,
      caffeineMg: p.caffeineMg,
      dogWalks: p.dogWalks,
      updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function writePlannerDailyBackupFromLogs(
  userId: string | undefined,
  dayKey: string,
  logs: DailyLogEntry[],
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PlannerDailyBackup = {
      waterOz: sumWaterOzToday(logs),
      sodiumMg: sumThermotabsSodiumMgTodayFromDailyLogs(logs),
      caffeineMg: sumCaffeineMgToday(logs),
      dogWalks: countDogWalksToday(logs, dayKey),
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(
      plannerDailyBackupKey(userId, dayKey),
      JSON.stringify(payload),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Fire-and-forget: two attempts, no UI alerts. Keeps optimistic UI if Supabase is slow.
 */
export function queuePersistDailyLogSilentRetries(
  row: DailyLogEntry,
  qc: QueryClient,
  onRemoteOk?: () => void,
): void {
  void (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await persistDailyLogToSupabaseNoTimeout(row);
        if (r.ok) {
          void qc.invalidateQueries({ queryKey: qk.dailyLogs, exact: true });
          onRemoteOk?.();
          return;
        }
      } catch {
        /* silent */
      }
      if (attempt === 0) {
        await new Promise((res) => setTimeout(res, 2500));
      }
    }
  })();
}
