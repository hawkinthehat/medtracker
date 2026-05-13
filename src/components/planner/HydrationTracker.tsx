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
  persistDailyLogToSupabase,
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
  fetchMedicationLogsFromSupabase,
  type MedicationLogRow,
} from "@/lib/supabase/medication-logs";
import {
  DEFAULT_SODIUM_GOAL_MG,
  DEFAULT_WATER_GOAL_OZ,
  DEFAULT_CALORIE_GOAL_KCAL,
  THERMOTABS_SODIUM_MG,
  WATER_OZ_LABEL,
  sumFoodKcalToday,
  sumThermotabsSodiumMgToday,
  sumThermotabsSodiumMgTodayFromDailyLogs,
  sumWaterOzToday,
} from "@/lib/hydration-summary";
import { toastMessageForPersistFailure } from "@/lib/supabase/auth-save-guard";
import { Check, Droplets, Pill } from "lucide-react";
import { FeatureHelpTrigger } from "@/components/FeatureHelpModal";
import { toastWaterLogged } from "@/lib/educational-toasts";
import { ENTRY_TYPE_CAFFEINE, ENTRY_TYPE_WATER } from "@/lib/daily-log-entry-type";

/** Shape held in the React Query cache under `qk.hydrationTotalsTodayRoot`. */
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
  /** Daily sodium goal from Thermotabs tally in mg (default 3000). */
  sodiumGoalMg?: number;
  /** Daily calorie goal for the progress strip (default 2000 kcal). */
  calorieGoalKcal?: number;
  /** Hide large header — for embedding under Pulse on home. */
  compact?: boolean;
  /** Bumped from home after sign-in so water/caffeine totals re-fetch today’s `recorded_at` window. */
  homeTotalsRefreshKey?: number;
};

export default function HydrationTracker({
  waterGoalOz = DEFAULT_WATER_GOAL_OZ,
  sodiumGoalMg = DEFAULT_SODIUM_GOAL_MG,
  calorieGoalKcal = DEFAULT_CALORIE_GOAL_KCAL,
  compact = false,
  homeTotalsRefreshKey = 0,
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

  const storedWaterOz = hydrationTotalsQuery.data?.oz ?? 0;
  const storedCaffeineMg = hydrationTotalsQuery.data?.caffeineMg ?? 0;
  const storedSodiumMg = hydrationTotalsQuery.data?.sodiumMg ?? 0;
  const storedCaloriesKcal = hydrationTotalsQuery.data?.caloriesKcal ?? 0;

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

  const hydrationTotalsLoaded =
    !supabaseConfigured ||
    !sessionUser ||
    hydrationTotalsQuery.data != null ||
    hydrationTotalsQuery.isError;

  const needsSignIn = supabaseConfigured && sessionResolved && !sessionUser;

  // Hard-cap the "…" placeholder at 2s — if the first totals fetch hangs we'd
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
      2000,
    );
    return () => window.clearTimeout(t);
  }, [awaitingFirstTotals]);
  const showTotalsPlaceholder =
    awaitingFirstTotals && !totalsPlaceholderTimedOut;

  const [toast, setToast] = useState<string | null>(null);

  const { data: dailyLogs = [] } = useQuery({
    queryKey: qk.dailyLogs,
    queryFn: dailyLogsQueryFn,
    staleTime: 60_000,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: medicationLogs = [] } = useQuery({
    queryKey: qk.medicationLogs,
    queryFn: () => fetchMedicationLogsFromSupabase(400),
    staleTime: 15_000,
    gcTime: 1000 * 60 * 60 * 24 * 7,
    refetchOnWindowFocus: true,
  });

  const cacheOz = useMemo(
    () => sumWaterOzToday(dailyLogs),
    [dailyLogs],
  );

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

  const cacheCaffeineMg = useMemo(
    () => sumCaffeineMgToday(dailyLogs),
    [dailyLogs],
  );

  const baselineCaffeineMg = !supabaseConfigured
    ? cacheCaffeineMg
    : !sessionResolved || !sessionUser
      ? 0
      : hydrationTotalsLoaded
        ? Math.max(storedCaffeineMg, cacheCaffeineMg)
        : cacheCaffeineMg;

  const currentCaffeineMg = baselineCaffeineMg;

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
  /** Which +oz button just fired — brief checkmark flash. */
  const [flashOz, setFlashOz] = useState<number | null>(null);
  /** Which caffeine preset just saved (cloud) — brief flash. */
  const [flashCaffeine, setFlashCaffeine] = useState<
    "coffee" | "energy" | null
  >(null);

  const currentWaterIntake =
    !supabaseConfigured || needsSignIn ? baselineOz + optimisticOz : baselineOz;

  const legacySodiumMedMg = useMemo(
    () => sumThermotabsSodiumMgToday(medicationLogs as MedicationLogRow[]),
    [medicationLogs],
  );

  const cacheDailySodiumMg = useMemo(
    () => sumThermotabsSodiumMgTodayFromDailyLogs(dailyLogs),
    [dailyLogs],
  );

  const sodiumMgToday = !supabaseConfigured
    ? legacySodiumMedMg + cacheDailySodiumMg
    : !sessionResolved || !sessionUser
      ? 0
      : legacySodiumMedMg + storedSodiumMg;

  const safeWaterGoalOz = Math.max(Number(waterGoalOz) || 0, 1e-9);
  const safeSodiumGoalMg = Math.max(Number(sodiumGoalMg) || 0, 1e-9);
  const safeCalorieGoalKcal = Math.max(Number(calorieGoalKcal) || 0, 1e-9);
  /** Bar fills to 100% at goal; numeric totals above goal still display for charts / doctors. */
  const waterBarPct = Math.min(currentWaterIntake / safeWaterGoalOz, 1) * 100;
  const sodiumBarPct = Math.min(sodiumMgToday / safeSodiumGoalMg, 1) * 100;
  const calorieBarPct = Math.min(
    caloriesKcalToday / safeCalorieGoalKcal,
    1,
  ) * 100;

  // Snapshot every matching `hydrationTotalsTodayRoot` cache entry so we can
  // roll the optimistic bump back on insert failure. Matching is by prefix
  // (`qk.hydrationTotalsTodayRoot` plus per-session/refresh suffixes).
  function snapshotTotalsCaches() {
    return qc.getQueriesData<HydrationTotalsCache>({
      queryKey: qk.hydrationTotalsTodayRoot,
    });
  }

  // Add `delta` to one field across every cached totals entry — drives the
  // dashboard number, progress bars, and embedded tracker without waiting on Supabase.
  function bumpTotalsOptimistic(
    field: "oz" | "caffeineMg" | "sodiumMg" | "caloriesKcal",
    delta: number,
  ) {
    qc.setQueriesData<HydrationTotalsCache>(
      { queryKey: qk.hydrationTotalsTodayRoot },
      (old) => ({
        oz: (old?.oz ?? 0) + (field === "oz" ? delta : 0),
        caffeineMg:
          (old?.caffeineMg ?? 0) + (field === "caffeineMg" ? delta : 0),
        sodiumMg:
          (old?.sodiumMg ?? 0) + (field === "sodiumMg" ? delta : 0),
        caloriesKcal:
          (old?.caloriesKcal ?? 0) + (field === "caloriesKcal" ? delta : 0),
        hasSession: old?.hasSession ?? true,
      }),
    );
  }

  function restoreTotalsCaches(
    snapshots: ReturnType<typeof snapshotTotalsCaches>,
  ) {
    for (const [key, data] of snapshots) {
      qc.setQueryData(key, data);
    }
  }

  const addOzMutation = useMutation({
    mutationFn: async (row: DailyLogEntry) => {
      try {
        const result = await persistDailyLogToSupabase(row);
        if (!result.ok) {
          throw new Error(result.error ?? "Could not save water log.");
        }
        const amountOz = Number(
          row.valueOz ??
            Number.parseInt(String(row.notes ?? "").trim(), 10),
        );
        return { amountOz, row };
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error("Could not save water log.");
      }
    },
    onMutate: async (row) => {
      await qc.cancelQueries({ queryKey: qk.hydrationTotalsTodayRoot });
      await qc.cancelQueries({ queryKey: qk.dailyLogs });
      const previousTotals = snapshotTotalsCaches();
      const previousDailyLogs =
        qc.getQueryData<DailyLogEntry[]>(qk.dailyLogs) ?? [];
      const deltaOz = Number(
        row.valueOz ??
          Number.parseInt(String(row.notes ?? "").trim(), 10),
      );
      if (Number.isFinite(deltaOz) && deltaOz > 0) {
        bumpTotalsOptimistic("oz", deltaOz);
      }
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      return { previousTotals, previousDailyLogs };
    },
    onError: (err: Error, _row, context) => {
      if (context?.previousTotals) restoreTotalsCaches(context.previousTotals);
      if (context?.previousDailyLogs) {
        qc.setQueryData(qk.dailyLogs, context.previousDailyLogs);
      }
      console.error("[hydration] water log failed:", err);
      setToast(toastMessageForPersistFailure(err.message));
      window.setTimeout(() => setToast(null), 3500);
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
      const { row, preset } = input;
      try {
        const result = await persistDailyLogToSupabase(row);
        if (!result.ok) {
          throw new Error(result.error ?? "Could not save caffeine log.");
        }
        const mg = Number(
          row.valueMg ??
            Number.parseInt(String(row.notes ?? "").trim(), 10),
        );
        return { preset, mg, row };
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error("Could not save caffeine log.");
      }
    },
    onMutate: async (input) => {
      const { row } = input;
      await qc.cancelQueries({ queryKey: qk.hydrationTotalsTodayRoot });
      await qc.cancelQueries({ queryKey: qk.dailyLogs });
      const previousTotals = snapshotTotalsCaches();
      const previousDailyLogs =
        qc.getQueryData<DailyLogEntry[]>(qk.dailyLogs) ?? [];
      const deltaMg = Number(
        row.valueMg ??
          Number.parseInt(String(row.notes ?? "").trim(), 10),
      );
      if (Number.isFinite(deltaMg) && deltaMg > 0) {
        bumpTotalsOptimistic("caffeineMg", deltaMg);
      }
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      return { previousTotals, previousDailyLogs };
    },
    onError: (err: Error, _input, context) => {
      if (context?.previousTotals) restoreTotalsCaches(context.previousTotals);
      if (context?.previousDailyLogs) {
        qc.setQueryData(qk.dailyLogs, context.previousDailyLogs);
      }
      console.error("[hydration] caffeine log failed:", err);
      setToast(toastMessageForPersistFailure(err.message));
      window.setTimeout(() => setToast(null), 3500);
    },
    onSuccess: ({ mg }) => {
      setToast(`Logged ${mg} mg caffeine.`);
      window.setTimeout(() => setToast(null), 3200);
    },
  });

  function quickAddOz(amount: number) {
    if (needsSignIn) {
      router.push(`/auth?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }

    if (!supabaseConfigured) {
      setOptimisticOz((o) => o + amount);
      setFlashOz(amount);
      window.setTimeout(() => setFlashOz(null), 700);
      setToast("Logged ✓");
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
      entryType: ENTRY_TYPE_WATER,
      valueOz: amount,
      unit: "oz",
      userId: sessionUser?.id,
    };
    addOzMutation.mutate(row);
  }

  function logCaffeine(preset: "coffee" | "energy") {
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
      entryType: ENTRY_TYPE_CAFFEINE,
      valueMg: mg,
      unit: "mg",
      userId: sessionUser?.id,
    };
    addCaffeineMutation.mutate({ row, preset });
  }

  const thermotabsCountToday = useMemo(() => {
    if (THERMOTABS_SODIUM_MG <= 0) return 0;
    return Math.max(0, Math.round(sodiumMgToday / THERMOTABS_SODIUM_MG));
  }, [sodiumMgToday]);

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
                  Water, caffeine &amp; salt today
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Fluid in ounces; caffeine estimates (mg); sodium tally from
                  Thermotabs taps in Quick relief save to{" "}
                  <span className="font-semibold text-slate-800">daily_logs</span>{" "}
                  (≈{THERMOTABS_SODIUM_MG} mg each).
                </p>
              </div>
              <FeatureHelpTrigger ariaLabel="Hydration help" title="Water & salt">
                <p>
                  Fluid and sodium targets support blood volume — helpful context
                  for orthostatic symptoms when paired with your care plan.
                </p>
              </FeatureHelpTrigger>
            </div>
          </div>
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
            <FeatureHelpTrigger ariaLabel="Hydration help" title="Water & salt">
              <p>
                Fluid and sodium targets support blood volume — helpful context
                for orthostatic symptoms when paired with your care plan.
              </p>
            </FeatureHelpTrigger>
          </div>
          <span className="shrink-0 rounded-lg border border-amber-700 bg-amber-100 px-2 py-1 text-xs font-black tabular-nums text-amber-950">
            Salt {sodiumMgToday} mg
          </span>
        </div>
      )}

      {!supabaseConfigured && (
        <p
          className={`rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 ${
            compact ? "mb-3" : "mt-3"
          }`}
        >
          Connect Supabase to sync hydration and Thermotab logs to your chart.
        </p>
      )}

      {needsSignIn && (
        <div
          className={`rounded-2xl border-4 border-black bg-slate-50 px-4 py-4 ${
            compact ? "mt-3" : "mt-4"
          }`}
        >
          <p className="text-lg font-bold leading-snug text-black">
            Please sign in to track water, caffeine, and salt. Your logs need an
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
            <span className="text-slate-400">…</span>
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
            {showTotalsPlaceholder ? "…" : `${currentCaffeineMg}`}
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
                ☕
              </span>
              <span>Coffee</span>
              <span className="mt-0.5 text-xs font-bold text-amber-900/90">
                ≈{CAFFEINE_COFFEE_MG} mg
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
                ⚡
              </span>
              <span className="text-center leading-tight">
                Energy drink / tea
              </span>
              <span className="mt-0.5 text-xs font-bold text-orange-900/90">
                ≈{CAFFEINE_ENERGY_OR_TEA_MG} mg
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className={compact ? "mt-4" : "mt-5"}>
        <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600">
          <span>Water goal</span>
          <span className="tabular-nums text-slate-900">
            {showTotalsPlaceholder ? "…" : currentWaterIntake} / {waterGoalOz} oz
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
            {showTotalsPlaceholder ? "…" : caloriesKcalToday} / {calorieGoalKcal}{" "}
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
          — best-guess kcal from what you ate.
        </p>
      </div>

      <div
        className={`flex items-start gap-3 rounded-xl border-2 border-amber-800/40 bg-amber-50/90 p-3 ${
          compact ? "mt-4" : "mt-5"
        }`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-amber-700 bg-white text-amber-900">
          <Pill className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-amber-950">
            Thermotabs sodium (today)
          </p>
          <p className="mt-1 font-mono text-2xl font-black tabular-nums text-amber-950">
            {sodiumMgToday}
            <span className="text-base font-bold text-amber-900/90"> mg</span>
            <span className="ml-2 text-sm font-bold text-amber-900/80">
              ({thermotabsCountToday} × {THERMOTABS_SODIUM_MG} mg)
            </span>
          </p>
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-amber-900/90">
              <span>Daily goal</span>
              <span className="tabular-nums">
                {sodiumMgToday} / {sodiumGoalMg} mg
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full border border-amber-600/50 bg-amber-100/80"
              role="progressbar"
              aria-valuenow={Math.round(sodiumBarPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-amber-600 transition-[width] duration-300 ease-out"
                style={{ width: `${sodiumBarPct}%` }}
              />
            </div>
          </div>
        </div>
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
