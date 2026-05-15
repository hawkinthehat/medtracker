"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Check, Pill } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { DEFAULT_SODIUM_GOAL_MG } from "@/lib/hydration-summary";
import {
  plannerDailyBackupKey,
  readPlannerDailyBackup,
  writePlannerDailyBackupFromLogs,
} from "@/lib/planner-daily-backup";
import { calendarDayLocal } from "@/lib/movement-tracking";
import { sumThermotabsSodiumMgTodayFromDailyLogs } from "@/lib/hydration-summary";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";

const SALT_GOAL_MG = DEFAULT_SODIUM_GOAL_MG;

type SaltTrackerProps = {
  compact?: boolean;
};

function persistSaltTotalToLocalStorage(
  userId: string | undefined,
  dayKey: string,
  sodiumMg: number,
): void {
  if (typeof window === "undefined") return;
  try {
    const prev = readPlannerDailyBackup(userId, dayKey);
    window.localStorage.setItem(
      plannerDailyBackupKey(userId, dayKey),
      JSON.stringify({
        waterOz: prev?.waterOz ?? 0,
        sodiumMg,
        caffeineMg: prev?.caffeineMg ?? 0,
        dogWalks: prev?.dogWalks ?? 0,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
}

export default function SaltTracker({ compact = false }: SaltTrackerProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const dayKey = calendarDayLocal();
  const sb = getSupabaseBrowserClient();
  const supabaseConfigured = Boolean(sb);

  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [saltTotal, setSaltTotal] = useState(0);
  const [isLogging, setIsLogging] = useState(false);
  const [flashMg, setFlashMg] = useState<250 | 500 | null>(null);

  const { data: dailyLogs = [] } = useQuery({
    queryKey: qk.dailyLogs,
    queryFn: dailyLogsQueryFn,
    staleTime: 60_000,
    enabled: supabaseConfigured,
  });

  useEffect(() => {
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
    return () => subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    const fromLogs = sumThermotabsSodiumMgTodayFromDailyLogs(dailyLogs);
    const fromLs =
      readPlannerDailyBackup(sessionUser?.id, dayKey)?.sodiumMg ?? 0;
    setSaltTotal((prev) => Math.max(prev, fromLogs, fromLs));
  }, [dailyLogs, sessionUser?.id, dayKey]);

  const saltBarPct = Math.min(
    100,
    Math.max(
      (saltTotal / Math.max(SALT_GOAL_MG, 1)) * 100,
      saltTotal > 0 ? 3 : 0,
    ),
  );

  const needsSignIn =
    supabaseConfigured && sessionResolved && !sessionUser;

  async function insertSaltRow(mg: number): Promise<boolean> {
    if (!sb || !sessionUser?.id) return false;
    const { error } = await sb.from("daily_logs").insert({
      id: crypto.randomUUID(),
      user_id: sessionUser.id,
      recorded_at: new Date().toISOString(),
      entry_type: "sodium",
      unit: "mg",
      category: "other",
      label: "Salt Tracker",
      value: mg,
    });
    if (error) {
      console.warn("[SaltTracker] daily_logs insert:", error.message);
      return false;
    }
    return true;
  }

  function handleSaltTap(mg: 250 | 500) {
    if (needsSignIn) return;

    setSaltTotal((prev) => {
      const next = prev + mg;
      persistSaltTotalToLocalStorage(sessionUser?.id, dayKey, next);
      return next;
    });
    setFlashMg(mg);
    window.setTimeout(() => setFlashMg(null), 700);

    if (!supabaseConfigured) return;

    void (async () => {
      setIsLogging(true);
      try {
        await insertSaltRow(mg);
        void qc.invalidateQueries({ queryKey: qk.dailyLogs, exact: true });
        writePlannerDailyBackupFromLogs(
          sessionUser?.id,
          dayKey,
          qc.getQueryData(qk.dailyLogs) ?? dailyLogs,
        );
      } catch (e) {
        console.warn("[SaltTracker] background save:", e);
      } finally {
        setIsLogging(false);
        router.refresh();
      }
    })();
  }

  return (
    <section
      className={`rounded-xl border-2 border-amber-800/40 bg-amber-50/90 ${
        compact ? "p-3" : "p-4"
      }`}
      aria-labelledby="salt-tracker-heading"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-amber-700 bg-white text-amber-900">
          <Pill className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="salt-tracker-heading"
            className="text-sm font-black text-amber-950"
          >
            Salt Tracker
          </h2>
          <p className="mt-1 font-mono text-2xl font-black tabular-nums text-amber-950">
            {saltTotal}
            <span className="text-base font-bold text-amber-900/90"> mg</span>
            <span className="ml-2 text-sm font-bold text-amber-900/80">
              today
            </span>
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-3 sm:justify-start">
            {([250, 500] as const).map((mg) => (
              <button
                key={mg}
                type="button"
                onClick={() => handleSaltTap(mg)}
                className={`relative flex min-h-[56px] min-w-[9.5rem] flex-col items-center justify-center rounded-2xl border-4 px-3 py-2 text-base font-black shadow-md transition hover:bg-amber-100 active:scale-[0.98] ${
                  mg === 250
                    ? "border-amber-900 text-amber-950 bg-amber-100/90"
                    : "border-orange-800 text-orange-950 bg-orange-100/90"
                } ${
                  flashMg === mg ? "bg-emerald-200 ring-2 ring-emerald-500" : ""
                }`}
              >
                {flashMg === mg ? (
                  <>
                    <Check className="h-7 w-7" strokeWidth={3} aria-hidden />
                    <span className="mt-0.5 text-xs font-black uppercase">
                      Logged
                    </span>
                  </>
                ) : (
                  <>{mg}mg Salt</>
                )}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-amber-900/90">
              <span>Daily goal</span>
              <span className="tabular-nums">
                {saltTotal} / {SALT_GOAL_MG} mg
                {isLogging ? " · syncing…" : ""}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full border border-amber-600/50 bg-amber-100/80"
              role="progressbar"
              aria-valuenow={Math.round(saltBarPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-amber-600 transition-[width] duration-300 ease-out"
                style={{ width: `${saltBarPct}%` }}
              />
            </div>
          </div>

          {!supabaseConfigured && (
            <p className="mt-2 text-xs font-semibold text-amber-950">
              Connect Supabase to sync salt logs.
            </p>
          )}
          {needsSignIn && (
            <p className="mt-2 text-sm font-bold text-amber-950">
              Sign in to sync salt to your account.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}