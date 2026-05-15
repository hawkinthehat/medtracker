"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { qk } from "@/lib/query-keys";
import type { DailyLogEntry } from "@/lib/types";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";
import {
  fetchTodayHydrationTotalsFromDailyLogs,
  type DailyLogsFullCycleHydrationTotals,
} from "@/lib/supabase/daily-logs";
import {
  CAFFEINE_COFFEE_LABEL,
  CAFFEINE_COFFEE_MG,
  CAFFEINE_ENERGY_LABEL,
  CAFFEINE_ENERGY_OR_TEA_MG,
  sumCaffeineMgToday,
} from "@/lib/caffeine-intake";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  DEFAULT_WATER_GOAL_OZ,
  DEFAULT_CALORIE_GOAL_KCAL,
  LEGACY_GLASS_LABEL,
  WATER_OZ_LABEL,
  isSameLocalCalendarDay,
  sumFoodKcalToday,
  sumThermotabsSodiumMgTodayFromDailyLogs,
  sumWaterOzToday,
} from "@/lib/hydration-summary";
import {
  readHydrationDayBackup,
  resetHydrationDayBackupFromServer,
  writeHydrationDayBackup,
} from "@/lib/hydration-local-backup";
import { toastMessageForPersistFailure } from "@/lib/supabase/auth-save-guard";
import { calendarDayLocal } from "@/lib/movement-tracking";
import {
  queuePersistDailyLogSilentRetries,
  readPlannerDailyBackup,
  writePlannerDailyBackupFromLogs,
} from "@/lib/planner-daily-backup";
import { Check, Droplets, RefreshCw } from "lucide-react";
import { FeatureHelpTrigger } from "@/components/FeatureHelpModal";
import { toastWaterLogged } from "@/lib/educational-toasts";
import { ENTRY_TYPE_CAFFEINE, ENTRY_TYPE_FOOD, ENTRY_TYPE_SODIUM, ENTRY_TYPE_WATER } from "@/lib/daily-log-entry-type";

/**
 * Cloud saves use optimistic React Query + `localStorage` totals via
 * {@link writePlannerDailyBackupFromLogs}, then {@link queuePersistDailyLogSilentRetries}
 * (no save-guard timeout, no error alerts).
 */
/**
 * Numeric payload for a log row: typed fields first, then optional `value` from API,
 * then `notes` integer fallback (matches `daily_logs` hydration rows).
 */
function dailyLogNumericPayload(log: DailyLogEntry): number {
  const fromUnknown = (log as { value?: unknown }).value;
  if (fromUnknown != null && String(fromUnknown).trim() !== "") {
    const n = Number(fromUnknown);
    if (Number.isFinite(n)) return n;
  }
  const oz = Number(log.valueOz);
  if (Number.isFinite(oz) && oz > 0) return oz;
  const mg = Number(log.valueMg);
  if (Number.isFinite(mg) && mg > 0) return mg;
  const k = Number(log.valueKcal);
  if (Number.isFinite(k) && k > 0) return k;
  const parsed = Number.parseInt(String(log.notes ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Today total water oz from cached logs â€” reduce + numeric fallback (empty day â†’ 0). */
function todayWaterOzFromLogsReduce(
  logs: DailyLogEntry[],
  ref = new Date(),
): number {
  const total = logs.reduce((acc, log) => {
    if (!log.recordedAt?.trim() || !isSameLocalCalendarDay(log.recordedAt, ref))
      return acc;

    if (
      log.entryType === ENTRY_TYPE_SODIUM ||
      log.entryType === "sodium" ||
      log.entryType === ENTRY_TYPE_FOOD ||
      log.entryType === "food"
    ) {
      return acc;
    }

    if (
      log.entryType === ENTRY_TYPE_CAFFEINE ||
      log.entryType === "caffeine" ||
      log.category === "caffeine"
    ) {
      return acc;
    }

    let add = 0;
    if (log.entryType === ENTRY_TYPE_WATER || log.entryType === "water") {
      if (log.label === LEGACY_GLASS_LABEL) add = 8;
      else {
        const v = dailyLogNumericPayload(log);
        add = Number.isFinite(v) && v > 0 ? v : 0;
      }
    } else if (
      log.category === "hydration" &&
      (log.label === WATER_OZ_LABEL || log.label === LEGACY_GLASS_LABEL)
    ) {
      if (log.label === LEGACY_GLASS_LABEL) add = 8;
      else {
        const v = dailyLogNumericPayload(log);
        add = Number.isFinite(v) && v > 0 ? v : 0;
      }
    }
    return acc + add;
  }, 0);
  return Math.max(0, Number.isFinite(total) ? total : 0);
}

/** Today caffeine mg from `daily_logs` rows with `entry_type` = `caffeine` only (matches Supabase). */
function todayCaffeineMgFromLogsReduce(
  logs: DailyLogEntry[],
  ref = new Date(),
): number {
  const total = logs.reduce((acc, log) => {
    if (!log.recordedAt?.trim() || !isSameLocalCalendarDay(log.recordedAt, ref))
      return acc;
    if (log.entryType !== ENTRY_TYPE_CAFFEINE && log.entryType !== "caffeine") {
      return acc;
    }
    const v = dailyLogNumericPayload(log);
    const add = Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
    return acc + add;
  }, 0);
  return Math.max(0, Number.isFinite(total) ? total : 0);
}
type HydrationTotalsCache = {
  oz: number;
  caffeineMg: number;
  sodiumMg: number;
  caloriesKcal: number;
  hasSession: boolean;
};

type HydrationTrackerProps = {
  /** Daily fluid goal in fluid ounces (default 100). */
  waterGoalOz?: number;
  /** Daily calorie goal for the progress strip (default 2000 kcal). */
  calorieGoalKcal?: number;
  /** Hide large header â€” for embedding under Pulse on home. */
  compact?: boolean;
  /** Bumped from home after sign-in so water/caffeine totals re-fetch todayâ€™s `recorded_at` window. */
  homeTotalsRefreshKey?: number;
  /**
   * After water / caffeine / salt inserts, re-pull todayâ€™s sums from Supabase
   * (`recorded_at` local day, same as `fetchTodayHydrationTotalsFromDailyLogs`) and
   * refresh React Query totals / invalidate `daily_logs`. Isolated from weather â€”
   * failures must not reject the save mutation.
   */
  onFullCycleSync?: () => Promise<
    DailyLogsFullCycleHydrationTotals | null | void
  >;
  /** When parent runs full-cycle sync (manual refresh or post-save). */
  fullCycleSyncing?: boolean;
};

export default function HydrationTracker({
  waterGoalOz = DEFAULT_WATER_GOAL_OZ,
  calorieGoalKcal = DEFAULT_CALORIE_GOAL_KCAL,
  compact = false,
  homeTotalsRefreshKey = 0,
  onFullCycleSync,
  fullCycleSyncing = false,
}: HydrationTrackerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);

  const hydrationTotalsQuery = useQuery({
    queryKey: [
      ...qk.hydrationTotalsTodayRoot,
      sessionUser?.id ?? "none",
      homeTotalsRefreshKey,
    ],
    queryFn: fetchTodayHydrationTotalsFromDailyLogs,
    enabled: Boolean(
      supabaseConfigured && sessionResolved && sessionUser,
    ),
    staleTime: 30_000,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: true,
  });

  const storedWaterOz = Math.max(
    0,
    Number(hydrationTotalsQuery.data?.oz) || 0,
  );
  const storedCaffeineMg = Math.max(
    0,
    Number(hydrationTotalsQuery.data?.caffeineMg) || 0,
  );
  const storedCaloriesKcal = Math.max(
    0,
    Number(hydrationTotalsQuery.data?.caloriesKcal) || 0,
  );

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    if (!sb) {
      setSessionUser(null);
      setSessionResolved(true);
      return;
    }
    void sb.auth.getUser().then(({ data: { user } }) => {
      setSessionUser(user ?? null);
      setSessionResolved(true);
    });
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(async () => {
      const {
        data: { user },
      } = await sb.auth.getUser();
      setSessionUser(user ?? null);
      setSessionResolved(true);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  }, []);

  const hydrationTotalsLoaded =
    !supabaseConfigured ||
    !sessionUser ||
    hydrationTotalsQuery.data != null ||
    hydrationTotalsQuery.isError;

  const needsSignIn = supabaseConfigured && sessionResolved && !sessionUser;

  // Hard-cap the "â€¦" placeholder at 2s â€” if the first totals fetch hangs we'd
  // rather show 0 and let optimistic taps populate the counter than freeze on a spinner.
  const [totalsPlaceholderTimedOut, setTotalsPlaceholderTimedOut] =
    useState(false);
  const awaitingFirstTotals =
    supabaseConfigured && !!sessionUser && !hydrationTotalsLoaded;
  useEffect(() => {
    if (!awaitingFirstTotals) {
      setTotalsPlaceholderTimedOut(false);
      return;
    }
    const t = window.setTimeout(
      () => setTotalsPlaceholderTimedOut(true),
      400,
    );
    return () => window.clearTimeout(t);
  }, [awaitingFirstTotals]);
  const showTotalsPlaceholder =
    awaitingFirstTotals && !totalsPlaceholderTimedOut;

  const [toast, setToast] = useState<string | null>(null);

  /** Last successful full-cycle totals from Supabase (water / salt / â€¦) â€” never tied to weather. */
  const [liveHydrationFromServer, setLiveHydrationFromServer] =
    useState<DailyLogsFullCycleHydrationTotals | null>(null);
  const [backupRev, setBackupRev] = useState(0);
  /** Immediate post-tap totals from local `daily_logs` cache so bars move before server round-trip. */
  const [coercedWaterTotalOverride, setCoercedWaterTotalOverride] = useState<
    number | null
  >(null);
  const [coercedCaffeineMgOverride, setCoercedCaffeineMgOverride] = useState<
    number | null
  >(null);

  /** Post-persist UI bypass: increments after successful insert, ignores RQ until refetch. */
  const [bypassWaterOzDelta, setBypassWaterOzDelta] = useState(0);
  const [bypassCaffeineMgDelta, setBypassCaffeineMgDelta] = useState(0);

  useEffect(() => {
    setLiveHydrationFromServer(null);
    setBackupRev((n) => n + 1);
    setCoercedWaterTotalOverride(null);
    setCoercedCaffeineMgOverride(null);
    setBypassWaterOzDelta(0);
    setBypassCaffeineMgDelta(0);
  }, [sessionUser?.id]);

  async function syncTodaysLogsFromServerAfterWrite() {
    if (!onFullCycleSync) return;
    try {
      const t = await onFullCycleSync();
      if (t) {
        setLiveHydrationFromServer(t);
        resetHydrationDayBackupFromServer(sessionUser?.id, t.oz, t.sodiumMg);
        // Only drop optimistic overrides when the server sum has caught up â€” otherwise
        // a stale `t` (e.g. read replica lag) zeros salt/caffeine and taps look "dead".
        setCoercedWaterTotalOverride((prev) => {
          if (prev == null) return null;
          const server = Number(t.oz) || 0;
          if (!Number.isFinite(server)) return null;
          return server < prev ? prev : null;
        });
        setCoercedCaffeineMgOverride((prev) => {
          if (prev == null) return null;
          const server = Number(t.caffeineMg) || 0;
          if (!Number.isFinite(server)) return null;
          return server < prev ? prev : null;
        });
        setBackupRev((n) => n + 1);
      }
    } catch (e) {
      console.warn("[hydration] todaysLogs sync (isolated from weather):", e);
    }
  }

  /** Post-insert full-cycle sync â€” delayed so DB sums/lists see the new row before we refetch. */
  function scheduleFullCycleSyncAfterWrite() {
    if (!onFullCycleSync) return;
    globalThis.setTimeout(() => {
      void syncTodaysLogsFromServerAfterWrite();
    }, 520);
  }

  const { data: dailyLogs = [] } = useQuery({
    queryKey: qk.dailyLogs,
    queryFn: dailyLogsQueryFn,
    staleTime: 60_000,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const plannerDayKey = calendarDayLocal();
  const plannerDailyBackup = useMemo(
    () => readPlannerDailyBackup(sessionUser?.id, plannerDayKey),
    [sessionUser?.id, plannerDayKey, dailyLogs, backupRev],
  );

  const cacheOz = useMemo(() => {
    const fromReduce = todayWaterOzFromLogsReduce(dailyLogs);
    const fromSum = sumWaterOzToday(dailyLogs);
    const fromLs = Number(plannerDailyBackup?.waterOz) || 0;
    return Math.max(
      0,
      Number(fromReduce) || 0,
      Number(fromSum) || 0,
      fromLs,
    );
  }, [dailyLogs, plannerDailyBackup]);

  /**
   * Server sums can briefly lag behind inserts; `daily_logs` cache includes taps
   * immediately. Use the higher of the two so the bar and totals always stack.
   */
  const baselineOz = !supabaseConfigured
    ? cacheOz
    : !sessionResolved || !sessionUser
      ? 0
      : hydrationTotalsLoaded
        ? Math.max(storedWaterOz, cacheOz)
        : cacheOz;

  const localBackup = useMemo(
    () => readHydrationDayBackup(sessionUser?.id ?? undefined),
    [sessionUser?.id, backupRev],
  );

  const cacheCaffeineMg = useMemo(() => {
    const fromStrict = todayCaffeineMgFromLogsReduce(dailyLogs);
    const fromSum = sumCaffeineMgToday(dailyLogs);
    const fromLs = Number(plannerDailyBackup?.caffeineMg) || 0;
    return Math.max(
      0,
      Number(fromStrict) || 0,
      Number(fromSum) || 0,
      fromLs,
    );
  }, [dailyLogs, plannerDailyBackup]);

  const baselineCaffeineMg = !supabaseConfigured
    ? cacheCaffeineMg
    : !sessionResolved || !sessionUser
      ? 0
      : hydrationTotalsLoaded
        ? Math.max(storedCaffeineMg, cacheCaffeineMg)
        : cacheCaffeineMg;

  const currentCaffeineMg = (() => {
    if (!supabaseConfigured || needsSignIn) {
      return Math.max(0, Number(baselineCaffeineMg) || 0);
    }
    const liveMg = Number(liveHydrationFromServer?.caffeineMg ?? 0) || 0;
    const base = Math.max(
      0,
      Number(baselineCaffeineMg) || 0,
      Number.isFinite(liveMg) ? liveMg : 0,
    );
    const merged =
      coercedCaffeineMgOverride != null &&
      Number(coercedCaffeineMgOverride) > 0
        ? Math.max(base, Number(coercedCaffeineMgOverride) || 0)
        : base;
    return Math.max(0, merged + (Number(bypassCaffeineMgDelta) || 0));
  })();

  const cacheFoodKcal = useMemo(
    () => sumFoodKcalToday(dailyLogs),
    [dailyLogs],
  );

  const baselineCaloriesKcal = !supabaseConfigured
    ? cacheFoodKcal
    : !sessionResolved || !sessionUser
      ? 0
      : hydrationTotalsLoaded
        ? Math.max(storedCaloriesKcal, cacheFoodKcal)
        : cacheFoodKcal;

  const caloriesKcalToday = baselineCaloriesKcal;

  /** Pending oz for offline-only mode (local cache); cloud path waits for DB insert. */
  const [optimisticOz, setOptimisticOz] = useState(0);
  /** Which +oz button just fired â€” brief checkmark flash. */
  const [flashOz, setFlashOz] = useState<number | null>(null);
  /** Which caffeine preset just saved (cloud) â€” brief flash. */
  const [flashCaffeine, setFlashCaffeine] = useState<
    "coffee" | "energy" | null
  >(null);
  const currentWaterIntake = (() => {
    if (!supabaseConfigured || needsSignIn) {
      return Math.max(
        0,
        (Number(baselineOz) || 0) + (Number(optimisticOz) || 0),
      );
    }
    const base = Math.max(
      0,
      Number(baselineOz) || 0,
      Number(liveHydrationFromServer?.oz ?? 0) || 0,
      Number(localBackup?.waterOzFromDailyLogs ?? 0) || 0,
    );
    const withTap =
      coercedWaterTotalOverride != null &&
      Number(coercedWaterTotalOverride) > 0
        ? Math.max(base, Number(coercedWaterTotalOverride) || 0)
        : base;
    return Math.max(0, withTap + (Number(bypassWaterOzDelta) || 0));
  })();

  const safeWaterGoalOz = Math.max(Number(waterGoalOz) || 0, 1e-9);
  const safeCalorieGoalKcal = Math.max(Number(calorieGoalKcal) || 0, 1e-9);

  const currentWaterNum = Math.max(0, Number(currentWaterIntake) || 0);
  const waterGoalNum = Math.max(Number(safeWaterGoalOz) || 0, 1e-9);
  const waterBarPctRaw = (currentWaterNum / waterGoalNum) * 100;
  const waterBarPct = Number.isFinite(waterBarPctRaw)
    ? Math.min(Math.max(waterBarPctRaw, 0), 100)
    : 0;

  const calorieNum = Math.max(0, Number(caloriesKcalToday) || 0);
  const calorieGoalNum = Math.max(Number(safeCalorieGoalKcal) || 0, 1e-9);
  const calorieBarPctRaw = (calorieNum / calorieGoalNum) * 100;
  const calorieBarPct = Number.isFinite(calorieBarPctRaw)
    ? Math.min(Math.max(calorieBarPctRaw, 0), 100)
    : 0;

  // Snapshot every matching `hydrationTotalsTodayRoot` cache entry so we can
  // roll the optimistic bump back on insert failure. Matching is by prefix
  // (`qk.hydrationTotalsTodayRoot` plus per-session/refresh suffixes).
  function snapshotTotalsCaches() {
    return qc.getQueriesData<HydrationTotalsCache>({
      queryKey: qk.hydrationTotalsTodayRoot,
    });
  }

  // Add `delta` to one field across every cached totals entry â€” drives the
  // dashboard number, progress bars, and embedded tracker without waiting on Supabase.
  function bumpTotalsOptimistic(
    field: "oz" | "caffeineMg" | "sodiumMg" | "caloriesKcal",
    delta: number,
  ) {
    qc.setQueriesData<HydrationTotalsCache>(
      { queryKey: qk.hydrationTotalsTodayRoot },
      (old) => ({
        oz: (Number(old?.oz) || 0) + (field === "oz" ? delta : 0),
        caffeineMg:
          (Number(old?.caffeineMg) || 0) + (field === "caffeineMg" ? delta : 0),
        sodiumMg:
          (Number(old?.sodiumMg) || 0) + (field === "sodiumMg" ? delta : 0),
        caloriesKcal:
          (Number(old?.caloriesKcal) || 0) +
          (field === "caloriesKcal" ? delta : 0),
        hasSession: old?.hasSession ?? true,
      }),
    );
  }

  const addOzMutation = useMutation({
    mutationFn: async (row: DailyLogEntry) => {
      const dk = calendarDayLocal();
      console.log("SENDING TO SUPABASE (background):", row);
      queuePersistDailyLogSilentRetries(row, qc, () => {
        writePlannerDailyBackupFromLogs(
          sessionUser?.id,
          dk,
          qc.getQueryData<DailyLogEntry[]>(qk.dailyLogs) ?? [],
        );
        scheduleFullCycleSyncAfterWrite();
        queueMicrotask(() => {
          router.refresh();
        });
      });
      const amountOz = Number(
        row.valueOz ??
          Number.parseInt(String(row.notes ?? "").trim(), 10),
      );
      if (Number.isFinite(amountOz) && amountOz > 0) {
        setBypassWaterOzDelta((prev) => prev + amountOz);
      }
      return { amountOz, row };
    },
    onMutate: async (row) => {
      void qc.cancelQueries({ queryKey: qk.hydrationTotalsTodayRoot });
      void qc.cancelQueries({ queryKey: qk.dailyLogs, exact: true });
      const previousTotals = snapshotTotalsCaches();
      const previousDailyLogs =
        qc.getQueryData<DailyLogEntry[]>(qk.dailyLogs) ?? [];
      const logsAfter: DailyLogEntry[] = [row, ...previousDailyLogs];
      const deltaOz = Number(
        row.valueOz ??
          Number.parseInt(String(row.notes ?? "").trim(), 10),
      );
      if (Number.isFinite(deltaOz) && deltaOz > 0) {
        bumpTotalsOptimistic("oz", deltaOz);
      }
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, logsAfter);
      writeHydrationDayBackup(sessionUser?.id, {
        waterOzFromDailyLogs: sumWaterOzToday(logsAfter),
        sodiumMgFromDailyLogs:
          sumThermotabsSodiumMgTodayFromDailyLogs(logsAfter),
      });
      writePlannerDailyBackupFromLogs(
        sessionUser?.id,
        calendarDayLocal(),
        logsAfter,
      );
      const nextWater = Math.max(
        todayWaterOzFromLogsReduce(logsAfter),
        sumWaterOzToday(logsAfter),
      );
      setCoercedWaterTotalOverride(nextWater > 0 ? nextWater : null);
      setBackupRev((n) => n + 1);
      return { previousTotals, previousDailyLogs };
    },
    onError: (err: Error) => {
      console.warn("[hydration] water mutation error (optimistic UI kept):", err);
    },
    onSuccess: ({ amountOz }) => {
      setToast(toastWaterLogged(amountOz));
      window.setTimeout(() => setToast(null), 4500);
    },
  });

  const addCaffeineMutation = useMutation({
    mutationFn: async (input: {
      row: DailyLogEntry;
      preset: "coffee" | "energy";
    }) => {
      const dk = calendarDayLocal();
      console.log("SENDING TO SUPABASE (background):", input.row);
      queuePersistDailyLogSilentRetries(input.row, qc, () => {
        writePlannerDailyBackupFromLogs(
          sessionUser?.id,
          dk,
          qc.getQueryData<DailyLogEntry[]>(qk.dailyLogs) ?? [],
        );
        scheduleFullCycleSyncAfterWrite();
        queueMicrotask(() => {
          router.refresh();
        });
      });
      const { row, preset } = input;
      const mg = Number(
        row.valueMg ??
          Number.parseInt(String(row.notes ?? "").trim(), 10),
      );
      if (Number.isFinite(mg) && mg > 0) {
        setBypassCaffeineMgDelta((prev) => prev + mg);
      }
      return { preset, mg, row };
    },
    onMutate: async (input) => {
      const { row } = input;
      void qc.cancelQueries({ queryKey: qk.hydrationTotalsTodayRoot });
      void qc.cancelQueries({ queryKey: qk.dailyLogs, exact: true });
      const previousTotals = snapshotTotalsCaches();
      const previousDailyLogs =
        qc.getQueryData<DailyLogEntry[]>(qk.dailyLogs) ?? [];
      const logsAfter: DailyLogEntry[] = [row, ...previousDailyLogs];
      const deltaMg = Number(
        row.valueMg ??
          Number.parseInt(String(row.notes ?? "").trim(), 10),
      );
      if (Number.isFinite(deltaMg) && deltaMg > 0) {
        bumpTotalsOptimistic("caffeineMg", deltaMg);
      }
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, logsAfter);
      writeHydrationDayBackup(sessionUser?.id, {
        waterOzFromDailyLogs: sumWaterOzToday(logsAfter),
        sodiumMgFromDailyLogs:
          sumThermotabsSodiumMgTodayFromDailyLogs(logsAfter),
      });
      writePlannerDailyBackupFromLogs(
        sessionUser?.id,
        calendarDayLocal(),
        logsAfter,
      );
      const nextCaffeine = Math.max(
        todayCaffeineMgFromLogsReduce(logsAfter),
        sumCaffeineMgToday(logsAfter),
      );
      setCoercedCaffeineMgOverride(nextCaffeine > 0 ? nextCaffeine : null);
      setBackupRev((n) => n + 1);
      return { previousTotals, previousDailyLogs };
    },
    onError: (err: Error) => {
      console.warn(
        "[hydration] caffeine mutation error (optimistic UI kept):",
        err,
      );
    },
    onSuccess: ({ mg }) => {
      setToast(`Logged ${mg} mg caffeine.`);
      window.setTimeout(() => setToast(null), 3200);
    },
  });

  function quickAddOz(amount: number) {
    console.log("INITIALIZING SAVE");
    if (needsSignIn) {
      router.push(`/auth?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }

    if (!supabaseConfigured) {
      setOptimisticOz((o) => o + amount);
      setFlashOz(amount);
      window.setTimeout(() => setFlashOz(null), 700);
      setToast("Logged âœ“");
      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        category: "hydration",
        label: WATER_OZ_LABEL,
        notes: String(amount),
        entryType: ENTRY_TYPE_WATER,
        valueOz: amount,
        unit: "oz",
      };
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      writePlannerDailyBackupFromLogs(
        sessionUser?.id,
        calendarDayLocal(),
        qc.getQueryData<DailyLogEntry[]>(qk.dailyLogs) ?? [],
      );
      setOptimisticOz((o) => Math.max(0, o - amount));
      window.setTimeout(() => {
        setToast(toastWaterLogged(amount, { localOnly: true }));
        window.setTimeout(() => setToast(null), 4500);
      }, 150);
      router.refresh();
      return;
    }

    setFlashOz(amount);
    window.setTimeout(() => setFlashOz(null), 700);
    const row: DailyLogEntry = {
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      category: "hydration",
      label: WATER_OZ_LABEL,
      notes: String(amount),
      /** Supabase `daily_logs.entry_type` â€” must be `water`. */
      entryType: ENTRY_TYPE_WATER,
      valueOz: amount,
      unit: "oz",
      userId: sessionUser?.id,
    };
    addOzMutation.mutate(row);
  }

  function logCaffeine(preset: "coffee" | "energy") {
    console.log("INITIALIZING SAVE");
    if (needsSignIn) {
      router.push(`/auth?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (!supabaseConfigured) {
      const mg =
        preset === "coffee" ? CAFFEINE_COFFEE_MG : CAFFEINE_ENERGY_OR_TEA_MG;
      const label =
        preset === "coffee" ? CAFFEINE_COFFEE_LABEL : CAFFEINE_ENERGY_LABEL;
      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        category: "caffeine",
        label,
        notes: String(mg),
        entryType: ENTRY_TYPE_CAFFEINE,
        valueMg: mg,
        unit: "mg",
      };
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      writePlannerDailyBackupFromLogs(
        sessionUser?.id,
        calendarDayLocal(),
        qc.getQueryData<DailyLogEntry[]>(qk.dailyLogs) ?? [],
      );
      setToast(`Logged ${mg} mg (this device only).`);
      window.setTimeout(() => setToast(null), 3200);
      router.refresh();
      return;
    }
    setFlashCaffeine(preset);
    window.setTimeout(() => setFlashCaffeine(null), 700);
    const mg =
      preset === "coffee" ? CAFFEINE_COFFEE_MG : CAFFEINE_ENERGY_OR_TEA_MG;
    const label =
      preset === "coffee" ? CAFFEINE_COFFEE_LABEL : CAFFEINE_ENERGY_LABEL;
    const row: DailyLogEntry = {
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      category: "caffeine",
      label,
      notes: String(mg),
      /** Supabase `daily_logs.entry_type` â€” must be `caffeine` (not `log_entry_type`). */
      entryType: ENTRY_TYPE_CAFFEINE,
      valueMg: mg,
      unit: "mg",
      userId: sessionUser?.id,
    };
    addCaffeineMutation.mutate({ row, preset });
  }

  return (
    <section
      aria-labelledby="hydration-heading"
      className={`rounded-2xl border-2 border-slate-900 bg-white shadow-sm ${
        compact ? "p-3 sm:p-4" : "p-4 ring-1 ring-slate-200/90 sm:p-5"
      }`}
    >
      {!compact && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-sky-600 bg-sky-50 text-sky-800">
              <Droplets className="h-6 w-6" aria-hidden />
            </span>
            <div className="flex flex-wrap items-start gap-2">
              <div>
                <h2
                  id="hydration-heading"
                  className="text-lg font-bold tracking-tight text-slate-900"
                >
                  Water &amp; caffeine today
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Fluid in ounces and caffeine estimates (mg) save to{" "}
                  <span className="font-semibold text-slate-800">daily_logs</span>{" "}
                  with <span className="font-mono">entry_type</span>{" "}
                  <span className="font-mono">water</span> or{" "}
                  <span className="font-mono">caffeine</span>.
                </p>
              </div>
              <FeatureHelpTrigger ariaLabel="Hydration help" title="Water & caffeine">
                <p>
                  Fluid targets support blood volume â€” helpful context for
                  orthostatic symptoms when paired with your care plan.
                </p>
              </FeatureHelpTrigger>
            </div>
          </div>
          {onFullCycleSync && supabaseConfigured && sessionUser ? (
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-slate-800 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              aria-label="Refresh todayâ€™s logs from server"
              disabled={fullCycleSyncing}
              onClick={() => void syncTodaysLogsFromServerAfterWrite()}
            >
              <RefreshCw
                className={`h-5 w-5 ${fullCycleSyncing ? "animate-spin" : ""}`}
                aria-hidden
              />
            </button>
          ) : null}
        </div>
      )}

      {compact && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Droplets className="h-5 w-5 shrink-0 text-sky-800" aria-hidden />
            <h2
              id="hydration-heading"
              className="text-sm font-bold uppercase tracking-[0.15em] text-slate-900"
            >
              Hydration
            </h2>
            <FeatureHelpTrigger ariaLabel="Hydration help" title="Water & caffeine">
              <p>
                Fluid targets support blood volume â€” helpful context for
                orthostatic symptoms when paired with your care plan.
              </p>
            </FeatureHelpTrigger>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onFullCycleSync && supabaseConfigured && sessionUser ? (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-800 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                aria-label="Refresh todayâ€™s logs from server"
                disabled={fullCycleSyncing}
                onClick={() => void syncTodaysLogsFromServerAfterWrite()}
              >
                <RefreshCw
                  className={`h-4 w-4 ${fullCycleSyncing ? "animate-spin" : ""}`}
                  aria-hidden
                />
              </button>
            ) : null}
          </div>
        </div>
      )}

      {!supabaseConfigured && (
        <p
          className={`rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 ${
            compact ? "mb-3" : "mt-3"
          }`}
        >
          Connect Supabase to sync hydration logs to your chart.
        </p>
      )}

      {needsSignIn && (
        <div
          className={`rounded-2xl border-4 border-black bg-slate-50 px-4 py-4 ${
            compact ? "mt-3" : "mt-4"
          }`}
        >
          <p className="text-lg font-bold leading-snug text-black">
            Please sign in to track water and caffeine. Your logs need an
            account so they save under the correct user.
          </p>
          <Link
            href={`/auth?next=${encodeURIComponent(pathname || "/")}`}
            className="mt-4 inline-flex min-h-[52px] min-w-[10rem] items-center justify-center rounded-xl border-4 border-black bg-black px-6 text-lg font-black text-white"
          >
            Sign in
          </Link>
        </div>
      )}

      <div className={compact ? "mt-1" : "mt-5"}>
        <p className="text-center font-mono text-4xl font-black tabular-nums text-slate-900">
          {showTotalsPlaceholder ? (
            <span className="text-slate-400">â€¦</span>
          ) : (
            <>
              {currentWaterIntake}
              <span className="text-2xl font-bold text-slate-600"> oz</span>
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {([8, 16, 32] as const).map((oz) => (
            <button
              key={oz}
              type="button"
              onClick={() => quickAddOz(oz)}
              className={`relative flex min-h-[56px] min-w-[5.5rem] flex-col items-center justify-center rounded-2xl border-4 border-black px-4 text-xl font-black text-white shadow-md transition hover:bg-sky-700 active:scale-[0.98] ${
                flashOz === oz ? "bg-emerald-600 ring-2 ring-emerald-300" : "bg-sky-600"
              }`}
            >
              {flashOz === oz ? (
                <>
                  <Check className="h-7 w-7" strokeWidth={3} aria-hidden />
                  <span className="mt-0.5 text-xs font-black uppercase tracking-wide">
                    Logged
                  </span>
                </>
              ) : (
                <>+{oz} oz</>
              )}
            </button>
          ))}
        </div>

        <div
          className={`mt-5 rounded-2xl border-2 border-amber-900/25 bg-gradient-to-br from-amber-50 to-orange-50/90 px-3 py-4 ${
            compact ? "mt-4" : ""
          }`}
        >
          <p className="text-center text-xs font-black uppercase tracking-[0.12em] text-amber-950">
            Caffeine (approx.)
          </p>
          <p className="mt-1 text-center font-mono text-2xl font-black tabular-nums text-amber-950">
            {showTotalsPlaceholder ? "â€¦" : `${currentCaffeineMg}`}
            <span className="text-base font-bold text-amber-900/90"> mg today</span>
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => logCaffeine("coffee")}
              className={`relative flex min-h-[56px] min-w-[10rem] max-w-full flex-col items-center justify-center rounded-2xl border-4 border-amber-900 px-3 py-2 text-base font-black text-amber-950 shadow-md transition hover:bg-amber-100 active:scale-[0.98] ${
                flashCaffeine === "coffee"
                  ? "bg-emerald-200 ring-2 ring-emerald-500"
                  : "bg-amber-200/90"
              }`}
            >
              <span className="text-lg" aria-hidden>
                â˜•
              </span>
              <span>Coffee</span>
              <span className="mt-0.5 text-xs font-bold text-amber-900/90">
                â‰ˆ{CAFFEINE_COFFEE_MG} mg
              </span>
            </button>
            <button
              type="button"
              onClick={() => logCaffeine("energy")}
              className={`relative flex min-h-[56px] min-w-[10rem] max-w-full flex-col items-center justify-center rounded-2xl border-4 border-orange-800 px-3 py-2 text-base font-black text-orange-950 shadow-md transition hover:bg-orange-100 active:scale-[0.98] ${
                flashCaffeine === "energy"
                  ? "bg-emerald-200 ring-2 ring-emerald-500"
                  : "bg-orange-200/90"
              }`}
            >
              <span className="text-lg" aria-hidden>
                âš¡
              </span>
              <span className="text-center leading-tight">
                Energy drink / tea
              </span>
              <span className="mt-0.5 text-xs font-bold text-orange-900/90">
                â‰ˆ{CAFFEINE_ENERGY_OR_TEA_MG} mg
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className={compact ? "mt-4" : "mt-5"}>
        <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600">
          <span>Water goal</span>
          <span className="tabular-nums text-slate-900">
            {showTotalsPlaceholder ? "â€¦" : currentWaterIntake} / {waterGoalOz} oz
          </span>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full border border-slate-300 bg-slate-100"
          role="progressbar"
          aria-valuenow={Math.round(waterBarPct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={
              optimisticOz > 0
                ? "h-full rounded-full bg-sky-600 transition-none"
                : "h-full rounded-full bg-sky-600 transition-[width] duration-300 ease-out"
            }
            style={{ width: `${waterBarPct}%` }}
          />
        </div>
      </div>

      <div className={compact ? "mt-4" : "mt-5"}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <span>Calories (logged)</span>
          <span className="tabular-nums text-slate-900">
            {showTotalsPlaceholder ? "â€¦" : caloriesKcalToday} / {calorieGoalKcal}{" "}
            kcal
          </span>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full border border-emerald-800/25 bg-emerald-50/90"
          role="progressbar"
          aria-valuenow={Math.round(calorieBarPct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 ease-out"
            style={{ width: `${calorieBarPct}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs font-semibold text-slate-600">
          <Link
            href="/food"
            className="font-bold text-emerald-800 underline underline-offset-2"
          >
            Smart nutrition log
          </Link>{" "}
          â€” best-guess kcal from what you ate.
        </p>
      </div>

      {toast && (
        <p
          className="mt-3 text-center text-[18px] font-medium leading-snug text-[#0f172a]"
          role="status"
        >
          {toast}
        </p>
      )}
    </section>
  );
}
