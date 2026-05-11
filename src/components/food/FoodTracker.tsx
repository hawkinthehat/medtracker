"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { qk } from "@/lib/query-keys";
import type { BrainFogEntry, DailyLogEntry, MoodEntry } from "@/lib/types";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";
import { persistDailyLogToSupabase } from "@/lib/supabase/daily-logs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { mealLinkedToRecentFlare } from "@/lib/food-flare-hint";
import { toastFoodLogged } from "@/lib/educational-toasts";

function recentFavoriteMeals(logs: DailyLogEntry[], limit = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const sorted = [...logs].sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
  for (const row of sorted) {
    if (row.category !== "food") continue;
    const label = row.label.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

export default function FoodTracker() {
  const qc = useQueryClient();
  const [manual, setManual] = useState("");
  const [inspectLabel, setInspectLabel] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const { data: dailyLogs = [] } = useQuery({
    queryKey: qk.dailyLogs,
    queryFn: dailyLogsQueryFn,
    staleTime: 60_000,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: moods = [] } = useQuery({
    queryKey: qk.moods,
    queryFn: async (): Promise<MoodEntry[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: brainFog = [] } = useQuery({
    queryKey: qk.brainFog,
    queryFn: async (): Promise<BrainFogEntry[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const favorites = useMemo(
    () => recentFavoriteMeals(dailyLogs, 5),
    [dailyLogs],
  );

  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

  const hintForInspect =
    inspectLabel &&
    mealLinkedToRecentFlare(inspectLabel, dailyLogs, moods, brainFog);

  const logFood = useMutation({
    mutationFn: async (label: string) => {
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Enter a meal name.");
      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        category: "food",
        label: trimmed,
      };
      if (supabaseConfigured) {
        const ok = await persistDailyLogToSupabase(row);
        if (!ok) throw new Error("Could not save — check Supabase.");
      }
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
      setInspectLabel(row.label);
      setStatus(toastFoodLogged(row.label));
      window.setTimeout(() => setStatus(null), 2400);
      setManual("");
    },
    onError: (e: Error) => {
      setStatus(e.message);
      window.setTimeout(() => setStatus(null), 4000);
    },
  });

  return (
    <div className="space-y-8 pb-16">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900">
          <UtensilsCrossed className="h-12 w-12 shrink-0" aria-hidden />
          Food tracker
        </h1>
        <p className="mt-3 text-xl font-medium text-slate-700">
          Tap a favorite or type something else — one tap logs the time for you.
        </p>
      </header>

      <section aria-labelledby="favorites-heading">
        <h2
          id="favorites-heading"
          className="text-2xl font-bold text-slate-900"
        >
          Favorites
        </h2>
        <p className="mt-2 text-lg text-slate-600">
          Last five different meals you logged (newest first).
        </p>
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {favorites.length === 0 && (
            <p className="text-xl text-slate-500">
              Log meals below — your top picks will appear here.
            </p>
          )}
          {favorites.map((meal) => (
            <button
              key={meal}
              type="button"
              disabled={logFood.isPending}
              onClick={() => {
                setInspectLabel(meal);
                logFood.mutate(meal);
              }}
              className="min-h-[72px] min-w-[11rem] shrink-0 rounded-2xl border-4 border-black bg-white px-5 py-4 text-left text-xl font-bold text-slate-900 shadow-md transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
            >
              {meal}
            </button>
          ))}
        </div>
      </section>

      {hintForInspect && inspectLabel && (
        <div
          className="rounded-2xl border-4 border-amber-600 bg-amber-50 p-5 shadow-sm"
          role="status"
        >
          <p className="text-2xl font-bold leading-snug text-amber-950">
            Note: This meal was linked to a flare last week. Eat with caution.
          </p>
          <p className="mt-2 text-lg font-medium text-amber-900">
            ({inspectLabel})
          </p>
        </div>
      )}

      <section aria-labelledby="manual-heading">
        <h2 id="manual-heading" className="text-2xl font-bold text-slate-900">
          Something else?
        </h2>
        <input
          className="mt-4 min-h-[60px] w-full rounded-xl border-4 border-black bg-white px-4 text-2xl font-semibold text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
          placeholder="Describe your meal"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          aria-label="Manual meal description"
        />
        <button
          type="button"
          disabled={logFood.isPending || !manual.trim()}
          onClick={() => logFood.mutate(manual)}
          className="mt-4 min-h-[60px] w-full rounded-xl border-4 border-black bg-sky-600 py-3 text-2xl font-black uppercase tracking-wide text-white hover:bg-sky-700 disabled:opacity-40"
        >
          Add meal
        </button>
      </section>

      {status && (
        <p className="text-center text-2xl font-bold text-slate-900" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
