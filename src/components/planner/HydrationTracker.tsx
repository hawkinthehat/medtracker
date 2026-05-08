"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { qk } from "@/lib/query-keys";
import type { DailyLogEntry } from "@/lib/types";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";
import {
  persistDailyLogToSupabase,
} from "@/lib/supabase/daily-logs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { Droplets } from "lucide-react";

const DEFAULT_GLASS_COUNT = 8;
const DEFAULT_DAILY_GOAL = 8;
const HYDRATION_LABEL = "Water glass";

function localDayParts(d: Date) {
  return {
    y: d.getFullYear(),
    m: d.getMonth(),
    day: d.getDate(),
  };
}

function isSameLocalCalendarDay(iso: string, ref = new Date()) {
  const a = new Date(iso);
  const r = localDayParts(ref);
  const x = localDayParts(a);
  return x.y === r.y && x.m === r.m && x.day === r.day;
}

function GlassIcon({
  filled,
  index,
  onTap,
}: {
  filled: boolean;
  index: number;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={
        filled ? `Glass ${index + 1}, filled` : `Glass ${index + 1}, empty`
      }
      aria-pressed={filled}
      className="flex h-[52px] w-[42px] shrink-0 touch-manipulation items-end justify-center rounded-xl border-2 border-slate-400 bg-white p-1 shadow-sm transition hover:border-sky-500 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:scale-[0.97] sm:h-[60px] sm:w-[48px]"
    >
      <svg
        viewBox="0 0 48 64"
        className="h-full w-full"
        aria-hidden
      >
        <path
          d="M14 6h20l2 8v42c0 3-2.5 6-5.5 6h-13C14.5 62 12 59 12 56V14l2-8z"
          fill={filled ? "rgba(37, 99, 235, 0.35)" : "rgba(241, 245, 249, 0.9)"}
          stroke="currentColor"
          strokeWidth={2}
          className="text-slate-700"
        />
        {filled && (
          <path
            d="M16 38h16v14c0 2.2-1.8 4-4 4h-8c-2.2 0-4-1.8-4-4V38z"
            fill="rgb(37 99 235)"
            opacity={0.85}
          />
        )}
      </svg>
    </button>
  );
}

type HydrationTrackerProps = {
  /** Number of glass icons in the row (default 8). */
  glassCount?: number;
  dailyGoal?: number;
  /** Hide large header — for embedding under Pulse on home. */
  compact?: boolean;
};

export default function HydrationTracker({
  glassCount = DEFAULT_GLASS_COUNT,
  dailyGoal = DEFAULT_DAILY_GOAL,
  compact = false,
}: HydrationTrackerProps) {
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

  const glassesToday = useMemo(() => {
    return dailyLogs.filter(
      (e) =>
        e.category === "hydration" &&
        e.label === HYDRATION_LABEL &&
        isSameLocalCalendarDay(e.recordedAt),
    ).length;
  }, [dailyLogs]);

  const filledDisplay = Math.min(glassesToday, glassCount);
  const progress = Math.min(1, glassesToday / dailyGoal);

  const addGlass = useMutation({
    mutationFn: async () => {
      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        category: "hydration",
        label: HYDRATION_LABEL,
      };
      const ok = await persistDailyLogToSupabase(row);
      if (supabaseConfigured && !ok) {
        throw new Error("Could not save glass — check Supabase.");
      }
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
      setToast(`Logged glass ${Math.min(glassesToday + 1, 99)} today`);
      window.setTimeout(() => setToast(null), 2000);
    },
    onError: (err: Error) => {
      setToast(err.message);
      window.setTimeout(() => setToast(null), 3200);
    },
  });

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
            <div>
              <h2
                id="hydration-heading"
                className="text-lg font-bold tracking-tight text-slate-900"
              >
                Water today
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Tap a glass for each cup you drink — saved to your daily log.
              </p>
            </div>
          </div>
        </div>
      )}

      {compact && (
        <div className="mb-3 flex items-center gap-2">
          <Droplets className="h-5 w-5 text-sky-800" aria-hidden />
          <h2
            id="hydration-heading"
            className="text-sm font-bold uppercase tracking-[0.15em] text-slate-900"
          >
            Hydration
          </h2>
        </div>
      )}

      {!supabaseConfigured && (
        <p
          className={`rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 ${
            compact ? "mb-3" : "mt-3"
          }`}
        >
          Connect Supabase to sync hydration to{" "}
          <code className="rounded bg-white px-1">daily_logs</code>.
        </p>
      )}

      <div
        className={`flex flex-wrap justify-center gap-2 sm:justify-between sm:gap-3 ${
          compact ? "mt-1" : "mt-5"
        }`}
      >
        {Array.from({ length: glassCount }, (_, i) => (
          <GlassIcon
            key={i}
            index={i}
            filled={i < filledDisplay}
            onTap={() => {
              if (i < filledDisplay) return;
              if (i !== filledDisplay) return;

              if (!supabaseConfigured) {
                const row: DailyLogEntry = {
                  id: crypto.randomUUID(),
                  recordedAt: new Date().toISOString(),
                  category: "hydration",
                  label: HYDRATION_LABEL,
                };
                qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
                  row,
                  ...prev,
                ]);
                setToast("Saved on this device only");
                window.setTimeout(() => setToast(null), 2000);
                return;
              }

              if (glassesToday >= glassCount) {
                setToast(
                  "You’ve filled every glass slot — add more from Daily summary if needed.",
                );
                window.setTimeout(() => setToast(null), 2800);
                return;
              }

              addGlass.mutate();
            }}
          />
        ))}
      </div>

      <div className={compact ? "mt-4" : "mt-5"}>
        <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600">
          <span>Daily goal</span>
          <span className="tabular-nums text-slate-900">
            {glassesToday} / {dailyGoal}
          </span>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full border border-slate-300 bg-slate-100"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-sky-600 transition-[width] duration-300 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {toast && (
        <p className="mt-3 text-center text-sm font-medium text-slate-800" role="status">
          {toast}
        </p>
      )}
    </section>
  );
}
