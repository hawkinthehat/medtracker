"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { qk } from "@/lib/query-keys";
import type { DailyLogEntry } from "@/lib/types";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";
import { persistDailyLogToSupabase } from "@/lib/supabase/daily-logs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  fetchMedicationLogsFromSupabase,
  type MedicationLogRow,
} from "@/lib/supabase/medication-logs";
import {
  DEFAULT_SODIUM_GOAL_MG,
  DEFAULT_WATER_GOAL_OZ,
  THERMOTABS_SODIUM_MG,
  WATER_OZ_LABEL,
  sumThermotabsSodiumMgToday,
  sumWaterOzToday,
} from "@/lib/hydration-summary";
import { Check, Droplets, Pill } from "lucide-react";
import { FeatureHelpTrigger } from "@/components/FeatureHelpModal";
import { toastWaterLogged } from "@/lib/educational-toasts";
import { ENTRY_TYPE_WATER } from "@/lib/daily-log-entry-type";

type HydrationTrackerProps = {
  /** Daily fluid goal in fluid ounces (default 100). */
  waterGoalOz?: number;
  /** Daily sodium goal from Thermotabs tally in mg (default 3000). */
  sodiumGoalMg?: number;
  /** Hide large header — for embedding under Pulse on home. */
  compact?: boolean;
};

export default function HydrationTracker({
  waterGoalOz = DEFAULT_WATER_GOAL_OZ,
  sodiumGoalMg = DEFAULT_SODIUM_GOAL_MG,
  compact = false,
}: HydrationTrackerProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const supabaseConfigured = Boolean(getSupabaseBrowserClient());
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

  const computedOz = useMemo(
    () => sumWaterOzToday(dailyLogs),
    [dailyLogs],
  );
  /** Pending oz not yet reflected in React Query cache after tap (optimistic UI). */
  const [optimisticOz, setOptimisticOz] = useState(0);
  /** Which +oz button just fired — brief checkmark flash. */
  const [flashOz, setFlashOz] = useState<number | null>(null);
  const currentWaterIntake = computedOz + optimisticOz;

  const sodiumMgToday = useMemo(
    () => sumThermotabsSodiumMgToday(medicationLogs as MedicationLogRow[]),
    [medicationLogs],
  );

  const waterProgress = Math.min(1, currentWaterIntake / waterGoalOz);
  const sodiumProgress = Math.min(1, sodiumMgToday / sodiumGoalMg);

  const addOzMutation = useMutation({
    mutationFn: async (amountOz: number) => {
      const sb = getSupabaseBrowserClient();
      let userId: string | undefined;
      if (sb) {
        const {
          data: { user },
        } = await sb.auth.getUser();
        userId = user?.id;
      }
      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        category: "hydration",
        label: WATER_OZ_LABEL,
        notes: String(amountOz),
        entryType: ENTRY_TYPE_WATER,
        userId,
      };
      const ok = await persistDailyLogToSupabase(row);
      if (supabaseConfigured && !ok) {
        throw new Error("Could not save — check Supabase.");
      }
      return row;
    },
    onSuccess: (row, amountOz) => {
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      setOptimisticOz((o) => Math.max(0, o - amountOz));
      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
      router.refresh();
      setToast(toastWaterLogged(amountOz));
      window.setTimeout(() => setToast(null), 4500);
    },
    onError: (err: Error, amountOz) => {
      setOptimisticOz((o) => Math.max(0, o - amountOz));
      setToast(err.message);
      window.setTimeout(() => setToast(null), 3200);
    },
  });

  function quickAddOz(amount: number) {
    setOptimisticOz((o) => o + amount);
    setFlashOz(amount);
    window.setTimeout(() => setFlashOz(null), 700);
    setToast("Logged ✓");
    if (!supabaseConfigured) {
      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        category: "hydration",
        label: WATER_OZ_LABEL,
        notes: String(amount),
        entryType: ENTRY_TYPE_WATER,
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
    addOzMutation.mutate(amount);
  }

  const thermotabsCountToday = useMemo(() => {
    const ref = new Date();
    let n = 0;
    for (const row of medicationLogs as MedicationLogRow[]) {
      if (row.medicationName !== "Thermotabs") continue;
      const t = new Date(row.recordedAt);
      if (
        t.getFullYear() === ref.getFullYear() &&
        t.getMonth() === ref.getMonth() &&
        t.getDate() === ref.getDate()
      ) {
        n += 1;
      }
    }
    return n;
  }, [medicationLogs]);

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
                  Water &amp; salt today
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Fluid in ounces; sodium tally from Thermotabs taps in Quick
                  relief (≈{THERMOTABS_SODIUM_MG} mg each).
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

      <div className={compact ? "mt-1" : "mt-5"}>
        <p className="text-center font-mono text-4xl font-black tabular-nums text-slate-900">
          {currentWaterIntake}
          <span className="text-2xl font-bold text-slate-600"> oz</span>
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {([8, 16, 32] as const).map((oz) => (
            <button
              key={oz}
              type="button"
              disabled={addOzMutation.isPending && supabaseConfigured}
              onClick={() => quickAddOz(oz)}
              className={`relative flex min-h-[56px] min-w-[5.5rem] flex-col items-center justify-center rounded-2xl border-4 border-black px-4 text-xl font-black text-white shadow-md transition hover:bg-sky-700 disabled:opacity-50 ${
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
      </div>

      <div className={compact ? "mt-4" : "mt-5"}>
        <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600">
          <span>Water goal</span>
          <span className="tabular-nums text-slate-900">
            {currentWaterIntake} / {waterGoalOz} oz
          </span>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full border border-slate-300 bg-slate-100"
          role="progressbar"
          aria-valuenow={Math.round(waterProgress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={
              optimisticOz > 0
                ? "h-full rounded-full bg-sky-600 transition-none"
                : "h-full rounded-full bg-sky-600 transition-[width] duration-300 ease-out"
            }
            style={{ width: `${waterProgress * 100}%` }}
          />
        </div>
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
              aria-valuenow={Math.round(sodiumProgress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-amber-600 transition-[width] duration-300 ease-out"
                style={{ width: `${sodiumProgress * 100}%` }}
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
