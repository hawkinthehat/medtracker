"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { DailyLogCategory, DailyLogEntry, JournalEntry } from "@/lib/types";
import {
  MCAS_PROXIMITY_MS,
  buildMergedTimeline,
  computeMcasProximityIds,
} from "@/lib/daily-summary";
import { labelJournalSetting } from "@/lib/journal-setting";
import { useMemo, useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import TodayMedicationStrip from "@/components/planner/TodayMedicationStrip";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";
import { persistDailyLogToSupabase } from "@/lib/supabase/daily-logs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { TOAST_DAILY_LOG } from "@/lib/educational-toasts";

const CATEGORIES: { value: DailyLogCategory; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "hydration", label: "Hydration" },
  { value: "caffeine", label: "Caffeine" },
  { value: "medication", label: "Medication" },
  { value: "sleep", label: "Sleep" },
  { value: "activity", label: "Activity" },
  { value: "other", label: "Other" },
];

function formatProximityHours(ms: number) {
  return ms / (60 * 60 * 1000);
}

export default function DailySummaryPage() {
  const qc = useQueryClient();
  const { data: dailyLogs = [] } = useQuery({
    queryKey: qk.dailyLogs,
    queryFn: dailyLogsQueryFn,
    staleTime: 60_000,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: journal = [] } = useQuery({
    queryKey: qk.journal,
    queryFn: async (): Promise<JournalEntry[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const [category, setCategory] = useState<DailyLogCategory>("food");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [recordedAtLocal, setRecordedAtLocal] = useState(() =>
    toDatetimeLocalInput(new Date())
  );
  const [dailyToast, setDailyToast] = useState<string | null>(null);

  useEffect(() => {
    if (!dailyToast) return;
    const t = window.setTimeout(() => setDailyToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [dailyToast]);

  const highlightIds = useMemo(
    () => computeMcasProximityIds(dailyLogs, journal),
    [dailyLogs, journal]
  );

  const timeline = useMemo(
    () => buildMergedTimeline(dailyLogs, journal),
    [dailyLogs, journal]
  );

  const addLog = useMutation({
    mutationFn: async (row: DailyLogEntry) => {
      const sb = getSupabaseBrowserClient();
      if (sb) {
        const result = await persistDailyLogToSupabase(row);
        if (!result.ok)
          throw new Error(result.error ?? "Could not save log — check Supabase.");
      }
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
      setLabel("");
      setNotes("");
      setRecordedAtLocal(toDatetimeLocalInput(new Date()));
      setDailyToast(TOAST_DAILY_LOG);
    },
  });

  function submitDaily(e: React.FormEvent) {
    e.preventDefault();
    const l = label.trim();
    if (!l) return;
    const iso = datetimeLocalToIso(recordedAtLocal);
    if (!iso) return;
    addLog.mutate({
      id: crypto.randomUUID(),
      recordedAt: iso,
      category,
      label: l,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link
          href="/journal"
          className="inline-flex items-center gap-1 text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Journal
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Daily summary
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            One timeline for <span className="text-slate-800">daily_logs</span>{" "}
            and <span className="text-slate-800">symptom_journal</span>. Food and
            symptom entries within{" "}
            {formatProximityHours(MCAS_PROXIMITY_MS)} hours are highlighted as
            possible MCAS triggers.
          </p>
        </div>
      </header>

      {dailyToast && (
        <p
          className="rounded-2xl border-4 border-emerald-800 bg-emerald-50 px-4 py-4 text-[18px] font-semibold leading-snug text-emerald-950"
          role="status"
        >
          {dailyToast}
        </p>
      )}

      <TodayMedicationStrip />

      <div
        className="rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-3 text-sm text-amber-950"
        role="note"
      >
        <span className="font-semibold text-amber-900">MCAS proximity: </span>
        Amber-bordered rows pair a <strong>food</strong> log with a{" "}
        <strong>journal</strong> entry logged within two hours. This is a
        correlation hint only—not a diagnosis.
      </div>

      <form
        onSubmit={submitDaily}
        className="space-y-4 rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60"
      >
        <h2 className="text-sm font-semibold text-slate-800">
          Add daily log
        </h2>
        <div>
          <label
            htmlFor="log-time"
            className="text-sm font-medium text-slate-700"
          >
            Time
          </label>
          <input
            id="log-time"
            type="datetime-local"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-slate-900"
            value={recordedAtLocal}
            onChange={(e) => setRecordedAtLocal(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="log-category"
            className="text-sm font-medium text-slate-700"
          >
            Category
          </label>
          <select
            id="log-category"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-slate-900"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as DailyLogCategory)
            }
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="log-label"
            className="text-sm font-medium text-slate-700"
          >
            Label
          </label>
          <input
            id="log-label"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-slate-900 placeholder:text-slate-600"
            placeholder="e.g., oatmeal with berries, walked 10 min"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="log-notes"
            className="text-sm font-medium text-slate-700"
          >
            Notes (optional)
          </label>
          <input
            id="log-notes"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-slate-900"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-slate-700 py-3 text-sm font-semibold text-white hover:bg-slate-600"
          disabled={!label.trim()}
        >
          Save daily log
        </button>
      </form>

      <section aria-labelledby="timeline-heading">
        <h2
          id="timeline-heading"
          className="text-sm font-semibold uppercase tracking-wider text-slate-500"
        >
          Timeline
        </h2>
        {timeline.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No daily logs or journal entries yet. Add food and symptoms with
            nearby times to see MCAS proximity highlighting.
          </p>
        ) : (
          <ol className="relative mt-4 border-l border-slate-300 pl-6">
            {timeline.map((row) => {
              const id = row.entry.id;
              const mcas = highlightIds.has(id);
              const time = new Date(row.entry.recordedAt);

              return (
                <li key={`${row.source}-${id}`} className="mb-6 last:mb-2">
                  <span
                    className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-slate-600 ring-4 ring-slate-950"
                    aria-hidden
                  />
                  <div
                    className={`rounded-2xl border px-4 py-3 ${
                      mcas
                        ? "border-amber-500/70 bg-amber-950/30 ring-1 ring-amber-500/25"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <time
                        className="font-mono text-slate-400"
                        dateTime={row.entry.recordedAt}
                      >
                        {time.toLocaleString()}
                      </time>
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium uppercase tracking-wide ${
                          row.source === "daily_log"
                            ? "bg-violet-950/80 text-violet-200 ring-1 ring-violet-700/40"
                            : "bg-sky-950/80 text-sky-200 ring-1 ring-sky-700/40"
                        }`}
                      >
                        {row.source === "daily_log"
                          ? `daily · ${row.entry.category}`
                          : "symptom journal"}
                      </span>
                      {mcas && (
                        <span className="rounded-full bg-amber-900/60 px-2 py-0.5 font-semibold text-amber-200 ring-1 ring-amber-600/50">
                          MCAS proximity
                        </span>
                      )}
                      {row.source === "symptom_journal" && (
                        <span className="rounded-full bg-slate-800/90 px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-600/50">
                          {labelJournalSetting(row.entry.setting)}
                        </span>
                      )}
                    </div>
                    {row.source === "daily_log" ? (
                      <>
                        <p className="mt-2 font-medium text-slate-900">
                          {row.entry.label}
                        </p>
                        {row.entry.notes && (
                          <p className="mt-1 text-sm text-slate-400">
                            {row.entry.notes}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {row.entry.text}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toDatetimeLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(value: string): string | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
