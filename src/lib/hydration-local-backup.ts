/**
 * Local-first hydration totals when Supabase is slow or offline (moving / flaky network).
 * Keys are per user + local calendar day.
 */

export type HydrationDayBackupV1 = {
  v: 1;
  /** Approximate sum of water oz from `daily_logs`-style taps today. */
  waterOzFromDailyLogs: number;
  /** Approximate sum of sodium mg from `daily_logs` taps today. */
  sodiumMgFromDailyLogs: number;
  updatedAt: string;
};

function localCalendarDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function storageKey(userId: string): string {
  return `tiaki-hydration-backup-v1:${userId}:${localCalendarDateKey()}`;
}

export function readHydrationDayBackup(
  userId: string | undefined,
): HydrationDayBackupV1 | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<HydrationDayBackupV1>;
    if (parsed?.v !== 1) return null;
    const water = Number(parsed.waterOzFromDailyLogs);
    const sod = Number(parsed.sodiumMgFromDailyLogs);
    if (!Number.isFinite(water) || !Number.isFinite(sod)) return null;
    return {
      v: 1,
      waterOzFromDailyLogs: Math.max(0, water),
      sodiumMgFromDailyLogs: Math.max(0, sod),
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeHydrationDayBackup(
  userId: string | undefined,
  patch: Partial<
    Pick<HydrationDayBackupV1, "waterOzFromDailyLogs" | "sodiumMgFromDailyLogs">
  >,
): void {
  if (!userId || typeof window === "undefined") return;
  try {
    const prev = readHydrationDayBackup(userId);
    const next: HydrationDayBackupV1 = {
      v: 1,
      waterOzFromDailyLogs: Math.max(
        0,
        patch.waterOzFromDailyLogs ?? prev?.waterOzFromDailyLogs ?? 0,
      ),
      sodiumMgFromDailyLogs: Math.max(
        0,
        patch.sodiumMgFromDailyLogs ?? prev?.sodiumMgFromDailyLogs ?? 0,
      ),
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

/** Overwrite backup with server totals after sync, without dropping below the last local tap (stale read protection). */
export function resetHydrationDayBackupFromServer(
  userId: string | undefined,
  waterOzFromDailyLogs: number,
  sodiumMgFromDailyLogs: number,
): void {
  const prev = readHydrationDayBackup(userId);
  writeHydrationDayBackup(userId, {
    waterOzFromDailyLogs: Math.max(
      0,
      Number(waterOzFromDailyLogs) || 0,
      prev?.waterOzFromDailyLogs ?? 0,
    ),
    sodiumMgFromDailyLogs: Math.max(
      0,
      Number(sodiumMgFromDailyLogs) || 0,
      prev?.sodiumMgFromDailyLogs ?? 0,
    ),
  });
}
