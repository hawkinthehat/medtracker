"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Dog, Dumbbell } from "lucide-react";
import { qk } from "@/lib/query-keys";
import { fetchTodayActivityCountsForCurrentUser } from "@/lib/supabase/activity-logs";

type DashboardTodayCountersProps = {
  /** False when Supabase off or user not signed in */
  enabled: boolean;
};

export default function DashboardTodayCounters({
  enabled,
}: DashboardTodayCountersProps) {
  const { data, isFetching } = useQuery({
    queryKey: qk.activityToday,
    queryFn: fetchTodayActivityCountsForCurrentUser,
    enabled,
    staleTime: 15_000,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: true,
  });

  if (!enabled) return null;

  const dogWalks = data?.dogWalks ?? 0;
  const ptSessions = data?.ptSessions ?? 0;
  const dogsDone = dogWalks > 0;
  const ptDone = ptSessions > 0;

  return (
    <div
      className="rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 shadow-sm"
      aria-live="polite"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
        Today&apos;s movement (activity_logs)
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-base font-bold text-slate-900">
        <span className="flex items-center gap-2">
          <Dog className="h-5 w-5 shrink-0 text-slate-800" aria-hidden />
          {dogsDone ? (
            <span className="flex items-center gap-1.5 text-emerald-800">
              <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
              Dogs walked ({dogWalks})
            </span>
          ) : (
            <span className="text-slate-600">
              Dogs walked —{" "}
              <span className="font-semibold text-amber-800">not yet</span>
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 shrink-0 text-slate-800" aria-hidden />
          {ptDone ? (
            <span className="flex items-center gap-1.5 text-emerald-800">
              <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
              PT logged ({ptSessions})
            </span>
          ) : (
            <span className="text-slate-600">
              PT —{" "}
              <span className="font-semibold text-amber-800">not yet</span>
            </span>
          )}
        </span>
        {isFetching && (
          <span className="text-xs font-medium text-slate-500">Updating…</span>
        )}
      </div>
    </div>
  );
}
