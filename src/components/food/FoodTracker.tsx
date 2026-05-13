"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { qk } from "@/lib/query-keys";
import type { BrainFogEntry, DailyLogEntry, MoodEntry } from "@/lib/types";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";
import { persistDailyLogToSupabase } from "@/lib/supabase/daily-logs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { ENTRY_TYPE_FOOD } from "@/lib/daily-log-entry-type";
import { estimateCaloriesFromDescription } from "@/lib/calorie-estimate";
import { mealLinkedToRecentFlare } from "@/lib/food-flare-hint";
import { toastFoodLogged } from "@/lib/educational-toasts";
import { isSameLocalCalendarDay } from "@/lib/hydration-summary";

/** Matches `HydrationTracker` / `qk.hydrationTotalsTodayRoot` cache shape. */
type HydrationTotalsCache = {
  oz: number;
  caffeineMg: number;
  sodiumMg: number;
  caloriesKcal: number;
  hasSession: boolean;
};

function mealDisplayText(row: DailyLogEntry): string {
  const fromNotes = row.notes?.trim();
  if (fromNotes) return fromNotes;
  return row.label.trim();
}

function recentFavoriteMeals(logs: DailyLogEntry[], limit = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const sorted = [...logs].sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
  for (const row of sorted) {
    if (row.category !== "food") continue;
    const label = mealDisplayText(row);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

function shortMealLabel(description: string, max = 72): string {
  const t = description.trim();
  if (!t) return "Meal";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function toDatetimeLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function datetimeLocalToIso(value: string): string | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function FoodTracker() {
  const qc = useQueryClient();
  const [whatYouAte, setWhatYouAte] = useState("");
  const [mealRecordedAtLocal, setMealRecordedAtLocal] = useState(() =>
    toDatetimeLocalInput(new Date()),
  );
  const [caloriesOverride, setCaloriesOverride] = useState<number | null>(null);
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

  const bestGuessKcal = useMemo(
    () => estimateCaloriesFromDescription(whatYouAte),
    [whatYouAte],
  );

  useEffect(() => {
    setCaloriesOverride(null);
  }, [whatYouAte]);

  const effectiveKcal =
    caloriesOverride != null &&
    Number.isFinite(caloriesOverride) &&
    caloriesOverride > 0
      ? Math.round(caloriesOverride)
      : bestGuessKcal;

  const hintForInspect =
    inspectLabel &&
    mealLinkedToRecentFlare(inspectLabel, dailyLogs, moods, brainFog);

  const logFood = useMutation({
    mutationFn: async (input: {
      description: string;
      kcal: number;
      recordedAtIso: string;
    }) => {
      const trimmed = input.description.trim();
      if (!trimmed) throw new Error("Describe what you ate.");
      const kcal = Math.round(input.kcal);
      if (!Number.isFinite(kcal) || kcal <= 0) {
        throw new Error("Enter a positive calorie estimate.");
      }
      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt: input.recordedAtIso,
        category: "food",
        entryType: ENTRY_TYPE_FOOD,
        label: shortMealLabel(trimmed),
        notes: trimmed,
        valueKcal: kcal,
        unit: "kcal",
      };
      if (supabaseConfigured) {
        const result = await persistDailyLogToSupabase(row);
        if (!result.ok)
          throw new Error(result.error ?? "Could not save — check Supabase.");
      }
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      const kcal = Number(row.valueKcal);
      if (
        Number.isFinite(kcal) &&
        kcal > 0 &&
        isSameLocalCalendarDay(row.recordedAt)
      ) {
        qc.setQueriesData<HydrationTotalsCache>(
          { queryKey: qk.hydrationTotalsTodayRoot },
          (old) => ({
            oz: old?.oz ?? 0,
            caffeineMg: old?.caffeineMg ?? 0,
            sodiumMg: old?.sodiumMg ?? 0,
            caloriesKcal: (old?.caloriesKcal ?? 0) + kcal,
            hasSession: old?.hasSession ?? true,
          }),
        );
      }
      void qc.invalidateQueries({ queryKey: qk.hydrationTotalsTodayRoot });
      const shown = mealDisplayText(row);
      setInspectLabel(shown);
      setStatus(toastFoodLogged(shown));
      window.setTimeout(() => setStatus(null), 2400);
      setWhatYouAte("");
      setCaloriesOverride(null);
      setMealRecordedAtLocal(toDatetimeLocalInput(new Date()));
    },
    onError: (e: Error) => {
      setStatus(e.message);
      window.setTimeout(() => setStatus(null), 4000);
    },
  });

  function submit(description: string, kcal: number) {
    const recordedAtIso = datetimeLocalToIso(mealRecordedAtLocal);
    if (!recordedAtIso) {
      setStatus("Pick a valid date and time for this meal.");
      window.setTimeout(() => setStatus(null), 3500);
      return;
    }
    logFood.mutate({ description, kcal, recordedAtIso });
  }

  return (
    <div className="space-y-8 pb-16">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900">
          <UtensilsCrossed className="h-12 w-12 shrink-0" aria-hidden />
          Smart nutrition log
        </h1>
        <p className="mt-3 text-xl font-medium text-slate-700">
          Describe what you ate — we suggest a best-guess calorie total you can
          adjust before saving. Entries sync to{" "}
          <span className="font-semibold text-slate-900">daily_logs</span> for
          your doctor report and flare timing.
        </p>
      </header>

      <section
        aria-labelledby="smart-nutrition-heading"
        className="rounded-2xl border-4 border-black bg-white p-5 shadow-md"
      >
        <h2
          id="smart-nutrition-heading"
          className="text-2xl font-bold text-slate-900"
        >
          Log a meal
        </h2>
        <div className="mt-4">
          <label
            htmlFor="meal-datetime"
            className="block text-lg font-bold text-slate-800"
          >
            When did you eat?
          </label>
          <input
            id="meal-datetime"
            type="datetime-local"
            value={mealRecordedAtLocal}
            onChange={(e) => setMealRecordedAtLocal(e.target.value)}
            className="mt-2 min-h-[52px] w-full max-w-md rounded-xl border-4 border-black bg-white px-3 py-2 text-lg font-semibold text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
          />
        </div>
        <label
          htmlFor="what-you-ate"
          className="mt-4 block text-lg font-bold text-slate-800"
        >
          What did you eat?
        </label>
        <textarea
          id="what-you-ate"
          className="mt-2 min-h-[100px] w-full resize-y rounded-xl border-4 border-black bg-white px-4 py-3 text-xl font-semibold text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
          placeholder="e.g. 2 eggs and toast, chicken salad…"
          value={whatYouAte}
          onChange={(e) => setWhatYouAte(e.target.value)}
          autoComplete="off"
        />
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[10rem] flex-1">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Best-guess calories
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-emerald-900">
              ~{bestGuessKcal > 0 ? bestGuessKcal : "—"}{" "}
              <span className="text-lg font-bold text-emerald-800/90">kcal</span>
            </p>
          </div>
          <div className="w-full max-w-[12rem]">
            <label
              htmlFor="kcal-override"
              className="block text-sm font-bold text-slate-700"
            >
              Adjust (kcal)
            </label>
            <input
              id="kcal-override"
              type="number"
              inputMode="numeric"
              min={1}
              max={8000}
              placeholder={bestGuessKcal > 0 ? String(bestGuessKcal) : ""}
              value={caloriesOverride ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  setCaloriesOverride(null);
                  return;
                }
                const n = Number(v);
                setCaloriesOverride(Number.isFinite(n) ? n : null);
              }}
              className="mt-1 w-full rounded-xl border-4 border-slate-400 bg-white px-3 py-2 text-xl font-black tabular-nums text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={
            logFood.isPending || !whatYouAte.trim() || effectiveKcal <= 0
          }
          onClick={() => submit(whatYouAte, effectiveKcal)}
          className="mt-6 min-h-[60px] w-full rounded-xl border-4 border-black bg-emerald-600 py-3 text-2xl font-black uppercase tracking-wide text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          Save meal (~{effectiveKcal > 0 ? effectiveKcal : "—"} kcal)
        </button>
      </section>

      <section aria-labelledby="favorites-heading">
        <h2
          id="favorites-heading"
          className="text-2xl font-bold text-slate-900"
        >
          Favorites
        </h2>
        <p className="mt-2 text-lg text-slate-600">
          Last five different meals (newest first). Tap to log again with the
          same description — review calories if your portion changed.
        </p>
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {favorites.length === 0 && (
            <p className="text-xl text-slate-500">
              Saved meals appear here for one-tap logging.
            </p>
          )}
          {favorites.map((meal) => (
            <button
              key={meal}
              type="button"
              disabled={logFood.isPending}
              onClick={() => {
                setInspectLabel(meal);
                const k = estimateCaloriesFromDescription(meal);
                submit(meal, k > 0 ? k : 250);
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

      {status && (
        <p
          className="text-center text-2xl font-bold text-slate-900"
          role="status"
        >
          {status}
        </p>
      )}
    </div>
  );
}
