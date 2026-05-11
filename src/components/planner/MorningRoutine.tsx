"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Activity, Check, Heart, Scale, UtensilsCrossed } from "lucide-react";
import { qk } from "@/lib/query-keys";
import type { DailyLogEntry, VitalRow } from "@/lib/types";
import { persistDailyLogToSupabase } from "@/lib/supabase/daily-logs";
import { persistVitalToSupabase } from "@/lib/supabase/vitals";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { fetchAndLogWeather } from "@/lib/weather";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";
import {
  findMorningMedsLogToday,
  MORNING_MEDS_TAKEN_LABEL,
} from "@/lib/morning-meds-log";
import { TOAST_MORNING_ROUTINE } from "@/lib/educational-toasts";
import MorningOrthostaticVitalCheck from "@/components/planner/MorningOrthostaticVitalCheck";

const BREAKFAST_LS = "medtracker-morning-breakfast-v1";
const MORNING_DONE_LS = "medtracker-morning-complete-day-v1";
const MORNING_END_HOUR = 12;

function calendarDayStamp(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadFavoriteBreakfast(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(BREAKFAST_LS)?.trim() ?? "";
  } catch {
    return "";
  }
}

function saveFavoriteBreakfast(label: string) {
  try {
    window.localStorage.setItem(BREAKFAST_LS, label.trim());
  } catch {
    /* ignore */
  }
}

function isMorningLocal(d = new Date()) {
  return d.getHours() < MORNING_END_HOUR;
}

export default function MorningRoutine() {
  const qc = useQueryClient();
  const morning = isMorningLocal();

  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">("lb");
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [hr, setHr] = useState("");
  const [breakfast, setBreakfast] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [savedFavorite, setSavedFavorite] = useState("");
  const [isLoggedToday, setIsLoggedToday] = useState(false);
  const [morningCompression, setMorningCompression] = useState(false);
  const [morningBinder, setMorningBinder] = useState(false);

  const { data: dailyLogs = [] } = useQuery({
    queryKey: qk.dailyLogs,
    queryFn: dailyLogsQueryFn,
    staleTime: 30_000,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
  });

  const morningMedsLogged = useMemo(
    () => findMorningMedsLogToday(dailyLogs),
    [dailyLogs],
  );

  useEffect(() => {
    const fav = loadFavoriteBreakfast();
    setSavedFavorite(fav);
    if (fav) setBreakfast((b) => (b.trim() ? b : fav));
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MORNING_DONE_LS);
      if (stored && stored === calendarDayStamp()) {
        setIsLoggedToday(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

  const logMorningMedsTaken = useMutation({
    mutationFn: async () => {
      const recordedAt = new Date().toISOString();
      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt,
        category: "other",
        label: MORNING_MEDS_TAKEN_LABEL,
        notes: recordedAt,
      };
      if (supabaseConfigured) {
        const ok = await persistDailyLogToSupabase(row);
        if (!ok) {
          throw new Error("Could not save morning meds — check Supabase.");
        }
      }
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      setToast("Morning meds logged to daily_logs.");
      window.setTimeout(() => setToast(null), 3200);
    },
    onError: (e: Error) => {
      setToast(e.message);
      window.setTimeout(() => setToast(null), 4200);
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const recordedAt = new Date().toISOString();
      const tasks: Promise<boolean>[] = [];
      const weightNum = Number(weight);
      const hasWeight =
        weight.trim() !== "" && Number.isFinite(weightNum) && weightNum > 0;
      const s = Number(sys);
      const d = Number(dia);
      const hasBp =
        sys.trim() !== "" &&
        dia.trim() !== "" &&
        Number.isFinite(s) &&
        Number.isFinite(d) &&
        s > 0 &&
        d > 0;
      const hrNum = Number(hr);
      const hasHr =
        hr.trim() !== "" &&
        Number.isFinite(hrNum) &&
        hrNum > 0 &&
        hrNum < 300;
      const breakfastTrim = breakfast.trim();

      if (!hasWeight && !hasBp && !breakfastTrim && !hasHr) {
        throw new Error(
          "Fill at least one: weight, blood pressure, heart rate, or breakfast.",
        );
      }

      if (
        (sys.trim() !== "" || dia.trim() !== "") &&
        !hasBp
      ) {
        throw new Error(
          "Enter both systolic and diastolic for blood pressure, or clear both.",
        );
      }

      await fetchAndLogWeather().catch(() => {});

      if (hasWeight) {
        const row: DailyLogEntry = {
          id: crypto.randomUUID(),
          recordedAt,
          category: "other",
          label: "Morning weight",
          notes: `${weightNum} ${unit}`,
        };
        tasks.push(
          (async () => {
            if (supabaseConfigured) {
              const ok = await persistDailyLogToSupabase(row);
              if (!ok) return false;
            }
            qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
              row,
              ...prev,
            ]);
            return true;
          })(),
        );
      }

      if (hasBp) {
        const vital: VitalRow = {
          id: crypto.randomUUID(),
          recordedAt,
          systolic: Math.round(s),
          diastolic: Math.round(d),
          heartRate: hasHr ? Math.round(hrNum) : undefined,
          notes: "Morning routine",
          compressionGarment: morningCompression,
          abdominalBinder: morningBinder,
        };
        tasks.push(
          (async () => {
            if (supabaseConfigured) {
              const ok = await persistVitalToSupabase(vital);
              if (!ok) return false;
            }
            qc.setQueryData<VitalRow[]>(qk.vitals, (prev = []) => [
              vital,
              ...prev,
            ]);
            return true;
          })(),
        );
      } else if (hasHr) {
        const pulseLog: DailyLogEntry = {
          id: crypto.randomUUID(),
          recordedAt,
          category: "other",
          label: "Morning heart rate",
          notes: `${Math.round(hrNum)} bpm`,
        };
        tasks.push(
          (async () => {
            if (supabaseConfigured) {
              const ok = await persistDailyLogToSupabase(pulseLog);
              if (!ok) return false;
            }
            qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
              pulseLog,
              ...prev,
            ]);
            return true;
          })(),
        );
      }

      if (breakfastTrim) {
        saveFavoriteBreakfast(breakfastTrim);
        const food: DailyLogEntry = {
          id: crypto.randomUUID(),
          recordedAt,
          category: "food",
          label: breakfastTrim,
          notes: "Morning routine — breakfast",
        };
        tasks.push(
          (async () => {
            if (supabaseConfigured) {
              const ok = await persistDailyLogToSupabase(food);
              if (!ok) return false;
            }
            qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
              food,
              ...prev,
            ]);
            return true;
          })(),
        );
      }

      const results = await Promise.all(tasks);
      if (supabaseConfigured && results.some((r) => !r)) {
        throw new Error("Some rows did not sync. Check Supabase.");
      }

      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
      void qc.invalidateQueries({ queryKey: qk.vitals });
      return true;
    },
    onSuccess: () => {
      setIsLoggedToday(true);
      try {
        window.localStorage.setItem(MORNING_DONE_LS, calendarDayStamp());
      } catch {
        /* ignore */
      }
      setToast(TOAST_MORNING_ROUTINE);
      window.setTimeout(() => setToast(null), 3200);
      setSavedFavorite(loadFavoriteBreakfast());
      setMorningCompression(false);
      setMorningBinder(false);
    },
    onError: (e: Error) => {
      setToast(e.message);
      window.setTimeout(() => setToast(null), 4200);
    },
  });

  return (
    <section
      aria-labelledby="morning-fastpass-heading"
      className={`rounded-2xl border-4 bg-white p-5 shadow-md ${
        morning
          ? "border-amber-500 ring-4 ring-amber-200/90"
          : "border-slate-900"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="morning-fastpass-heading"
          className="text-2xl font-bold text-slate-900"
        >
          Morning routine
        </h2>
        {morning && (
          <span className="rounded-full border-2 border-amber-700 bg-amber-100 px-3 py-1 text-sm font-bold uppercase tracking-wide text-amber-950">
            Morning
          </span>
        )}
      </div>
      <p className="mt-2 text-lg font-medium text-slate-700">
        Log morning meds with one tap; weight, BP, heart rate, and breakfast in
        one save below.
      </p>

      {isLoggedToday ? (
        <div className="mt-8 flex flex-col gap-4 rounded-2xl border-4 border-black bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="text-center text-2xl font-black leading-snug text-slate-900 sm:text-left sm:text-3xl">
            ✅ Morning Tasks Complete
          </p>
          <button
            type="button"
            onClick={() => {
              setIsLoggedToday(false);
              try {
                window.localStorage.removeItem(MORNING_DONE_LS);
              } catch {
                /* ignore */
              }
            }}
            className="min-h-[52px] shrink-0 rounded-xl border-4 border-black bg-white px-6 text-xl font-bold text-slate-900 hover:bg-slate-50"
          >
            Edit
          </button>
        </div>
      ) : (
        <>
          <MorningOrthostaticVitalCheck />

          <div className="mt-6">
            {morningMedsLogged ? (
              <div className="flex min-h-[72px] items-center gap-4 rounded-2xl border-4 border-emerald-700 bg-emerald-50 px-5 py-4">
                <Check
                  className="h-12 w-12 shrink-0 text-emerald-800"
                  strokeWidth={2.5}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-xl font-black leading-tight text-emerald-950">
                    ☀️ Morning meds taken
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">
                    Logged{" "}
                    {new Date(morningMedsLogged.recordedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={logMorningMedsTaken.isPending}
                onClick={() => {
                  if (!supabaseConfigured) {
                    const recordedAt = new Date().toISOString();
                    const row: DailyLogEntry = {
                      id: crypto.randomUUID(),
                      recordedAt,
                      category: "other",
                      label: MORNING_MEDS_TAKEN_LABEL,
                      notes: recordedAt,
                    };
                    qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
                      row,
                      ...prev,
                    ]);
                    setToast("Morning meds saved on this device only.");
                    window.setTimeout(() => setToast(null), 3200);
                    return;
                  }
                  logMorningMedsTaken.mutate();
                }}
                className="flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl border-4 border-amber-600 bg-amber-100 px-5 py-4 text-left shadow-md transition hover:bg-amber-200 disabled:opacity-60"
              >
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-4 border-black bg-white text-3xl"
                  aria-hidden
                >
                  ☀️
                </span>
                <span className="text-2xl font-black leading-tight text-slate-950">
                  Morning Meds Taken
                </span>
              </button>
            )}
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <label className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Scale className="h-10 w-10 shrink-0 text-slate-900" aria-hidden />
                Morning weight
              </label>
              <div className="mt-3 flex flex-wrap gap-3">
                <input
                  inputMode="decimal"
                  className="min-h-[60px] min-w-[8rem] flex-1 rounded-xl border-4 border-black bg-white px-4 text-2xl font-semibold text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
                  placeholder="e.g. 142"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  aria-label="Morning weight number"
                />
                <div className="flex gap-2">
                  {(["lb", "kg"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`min-h-[60px] min-w-[4.5rem] rounded-xl border-4 px-4 text-xl font-bold uppercase ${
                        unit === u
                          ? "border-black bg-slate-900 text-white"
                          : "border-slate-400 bg-white text-slate-900"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Heart className="h-10 w-10 shrink-0 text-red-700" aria-hidden />
                Morning BP
              </label>
              <div className="mt-3 flex flex-wrap gap-3">
                <input
                  inputMode="numeric"
                  className="min-h-[60px] w-full min-w-[7rem] flex-1 rounded-xl border-4 border-black bg-white px-4 text-2xl font-semibold text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-sky-400 sm:max-w-[12rem]"
                  placeholder="Systolic"
                  value={sys}
                  onChange={(e) => setSys(e.target.value)}
                  aria-label="Systolic blood pressure"
                />
                <input
                  inputMode="numeric"
                  className="min-h-[60px] w-full min-w-[7rem] flex-1 rounded-xl border-4 border-black bg-white px-4 text-2xl font-semibold text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-sky-400 sm:max-w-[12rem]"
                  placeholder="Diastolic"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                  aria-label="Diastolic blood pressure"
                />
              </div>

              <div className="mt-4 rounded-2xl border-4 border-black bg-slate-50 p-4">
                <p className="text-lg font-black text-slate-900">
                  Gear during this BP reading
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-base font-bold text-slate-800">
                      Wearing compression?
                    </p>
                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setMorningCompression(true)}
                        className={`min-h-[56px] flex-1 rounded-2xl border-4 border-black text-lg font-black ${
                          morningCompression
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-slate-900"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setMorningCompression(false)}
                        className={`min-h-[56px] flex-1 rounded-2xl border-4 border-black text-lg font-black ${
                          !morningCompression
                            ? "bg-slate-700 text-white"
                            : "bg-white text-slate-900"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-800">
                      Abdominal binder?
                    </p>
                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setMorningBinder(true)}
                        className={`min-h-[56px] flex-1 rounded-2xl border-4 border-black text-lg font-black ${
                          morningBinder
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-slate-900"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setMorningBinder(false)}
                        className={`min-h-[56px] flex-1 rounded-2xl border-4 border-black text-lg font-black ${
                          !morningBinder
                            ? "bg-slate-700 text-white"
                            : "bg-white text-slate-900"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Activity className="h-10 w-10 shrink-0 text-sky-800" aria-hidden />
                Morning HR
              </label>
              <input
                inputMode="numeric"
                className="mt-3 min-h-[60px] w-full max-w-[14rem] rounded-xl border-4 border-black bg-white px-4 text-2xl font-semibold text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
                placeholder="Resting pulse"
                value={hr}
                onChange={(e) => setHr(e.target.value)}
                aria-label="Morning heart rate"
              />
              <p className="mt-2 text-base font-medium text-slate-600">
                Optional if you logged BP above — otherwise HR alone is OK.
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <UtensilsCrossed
                  className="h-10 w-10 shrink-0 text-slate-900"
                  aria-hidden
                />
                Breakfast
              </label>
              <input
                className="mt-3 min-h-[60px] w-full rounded-xl border-4 border-black bg-white px-4 text-2xl font-semibold text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
                placeholder="What did you eat?"
                value={breakfast}
                onChange={(e) => setBreakfast(e.target.value)}
                aria-label="Breakfast description"
              />
              {savedFavorite !== "" && (
                <button
                  type="button"
                  className="mt-3 min-h-[60px] w-full rounded-xl border-4 border-slate-900 bg-slate-50 py-3 text-xl font-bold text-slate-900 transition active:scale-[0.99]"
                  onClick={() => setBreakfast(savedFavorite)}
                >
                  Quick add: {savedFavorite}
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={
              submit.isPending ||
              !(
                weight.trim() !== "" ||
                (sys.trim() !== "" && dia.trim() !== "") ||
                hr.trim() !== "" ||
                breakfast.trim() !== ""
              )
            }
            onClick={() => submit.mutate()}
            className="mt-8 min-h-[60px] w-full rounded-xl border-4 border-black bg-sky-600 py-4 text-2xl font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-sky-700 disabled:opacity-40"
          >
            {submit.isPending ? "Saving…" : "Submit all"}
          </button>
        </>
      )}

      {!supabaseConfigured && (
        <p className="mt-4 rounded-xl border-2 border-amber-600 bg-amber-50 p-3 text-lg font-medium text-amber-950">
          Connect Supabase to sync vitals and logs to the cloud.
        </p>
      )}

      {toast && (
        <p className="mt-4 text-center text-xl font-bold text-slate-900" role="status">
          {toast}
        </p>
      )}
    </section>
  );
}
