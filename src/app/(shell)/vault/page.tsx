"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  averageOrthostaticDeltaLastDays,
  rollingAverageBrainFog7d,
  rollingAverageMood7d,
} from "@/lib/clinical-summary-stats";
import { generateTransitionClinicalPdf } from "@/lib/transition-summary-pdf";
import { qk } from "@/lib/query-keys";
import {
  SEED_SAVED_MEDICATIONS,
  type SavedMedication,
} from "@/lib/seed-medications";
import type {
  BrainFogEntry,
  DailyLogEntry,
  JournalEntry,
  MoodEntry,
  OrthostaticSession,
  SafetyGateBlockEvent,
} from "@/lib/types";
import {
  HISTAMINE_TRIGGER_WINDOW_MS,
  findSuspectedHistamineTriggerFoodIds,
} from "@/lib/trigger-finder";
import { useMemo } from "react";
import { AlertTriangle, FileDown } from "lucide-react";
import ClinicalSummaryCard from "@/components/ClinicalSummaryCard";
import DrugTolerabilityReport from "@/components/DrugTolerabilityReport";
import TaperSensitivitySection from "@/components/TaperSensitivitySection";

function formatWindowMinutes(ms: number) {
  return Math.round(ms / (60 * 1000));
}

export default function VaultPage() {
  const { data: dailyLogs = [] } = useQuery({
    queryKey: qk.dailyLogs,
    queryFn: async (): Promise<DailyLogEntry[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: journal = [] } = useQuery({
    queryKey: qk.journal,
    queryFn: async (): Promise<JournalEntry[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: medications = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: async (): Promise<SavedMedication[]> => SEED_SAVED_MEDICATIONS,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: orthostatic = [] } = useQuery({
    queryKey: qk.orthostatic,
    queryFn: async (): Promise<OrthostaticSession[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
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

  const { data: safetyGateBlocks = [] } = useQuery({
    queryKey: qk.safetyGateBlocks,
    queryFn: async (): Promise<SafetyGateBlockEvent[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const suspectFoodIds = useMemo(
    () => findSuspectedHistamineTriggerFoodIds(dailyLogs, journal),
    [dailyLogs, journal]
  );

  const flaggedFoods = useMemo(
    () =>
      dailyLogs.filter(
        (d) => d.category === "food" && suspectFoodIds.has(d.id)
      ),
    [dailyLogs, suspectFoodIds]
  );

  const moodAvg7 = useMemo(
    () => rollingAverageMood7d(moods),
    [moods]
  );

  const fogAvg7 = useMemo(
    () => rollingAverageBrainFog7d(brainFog),
    [brainFog]
  );

  const orthoDelta7 = useMemo(
    () => averageOrthostaticDeltaLastDays(orthostatic, 7),
    [orthostatic]
  );

  const exportPdf = useMutation({
    mutationFn: async () => {
      await generateTransitionClinicalPdf({
        medications,
        safetyGateBlocks,
        orthostatic,
        moods,
        brainFog,
      });
    },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Vault
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
          Trigger Finder compares{" "}
          <span className="text-slate-200">daily_logs</span> (food) with{" "}
          <span className="text-slate-200">symptom_journal</span> entries. When a
          flare or pain note lands within{" "}
          {formatWindowMinutes(HISTAMINE_TRIGGER_WINDOW_MS)} minutes{" "}
          <strong className="font-medium text-slate-300">after</strong> a food
          log, that food is flagged here as a suspected histamine trigger for
          your allergist-led diet planning.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 ring-1 ring-white/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">
              Transition Summary
            </h2>
            <p className="mt-1 max-w-prose text-sm text-slate-400">
              Seven-day rolling averages for mood and brain fog as your
              environment shifts (e.g. Missouri transition). Export a clinical
              PDF for specialty visits.
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportPdf.mutate()}
            disabled={exportPdf.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-600/50 bg-sky-950/40 px-4 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-900/50 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" aria-hidden />
            {exportPdf.isPending ? "Building PDF…" : "Export PDF"}
          </button>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Mood (7d avg)
            </dt>
            <dd className="mt-1 font-mono text-2xl tabular-nums text-slate-50">
              {moodAvg7 != null ? moodAvg7.toFixed(2) : "—"}
              <span className="ml-1 text-sm font-sans font-normal text-slate-500">
                /5
              </span>
            </dd>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Brain fog (7d avg)
            </dt>
            <dd className="mt-1 font-mono text-2xl tabular-nums text-slate-50">
              {fogAvg7 != null ? fogAvg7.toFixed(2) : "—"}
              <span className="ml-1 text-sm font-sans font-normal text-slate-500">
                /10
              </span>
            </dd>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Orthostatic Δ (7d mean)
            </dt>
            <dd className="mt-1 font-mono text-lg leading-snug tabular-nums text-slate-50">
              {orthoDelta7.count === 0 ? (
                <span className="text-slate-500">No sessions</span>
              ) : (
                <>
                  ΔSBP{" "}
                  {orthoDelta7.meanDeltaSystolic?.toFixed(1) ?? "—"} · ΔDBP{" "}
                  {orthoDelta7.meanDeltaDiastolic?.toFixed(1) ?? "—"}{" "}
                  <span className="block text-xs font-normal text-slate-500">
                    mmHg · {orthoDelta7.count} session
                    {orthoDelta7.count === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </dd>
          </div>
        </dl>

        {exportPdf.isError && (
          <p className="mt-4 text-sm text-red-400" role="alert">
            Could not generate PDF. Try again.
          </p>
        )}
      </section>

      <DrugTolerabilityReport />

      <TaperSensitivitySection />

      <ClinicalSummaryCard />

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 ring-1 ring-white/5">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle
            className="h-5 w-5 text-amber-400"
            aria-hidden
          />
          <h2 className="text-lg font-semibold text-slate-50">
            Suspected histamine triggers
          </h2>
          <span className="rounded-full bg-amber-950/80 px-2 py-0.5 text-xs font-medium text-amber-200">
            {flaggedFoods.length} flagged
          </span>
        </div>

        {flaggedFoods.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No correlations yet. Log food on the Daily summary and symptoms in
            the Journal — foods followed by a symptom within two hours appear
            here automatically.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {flaggedFoods.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-100">{row.label}</span>
                  <time
                    className="text-xs text-slate-500"
                    dateTime={row.recordedAt}
                  >
                    {new Date(row.recordedAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-amber-200/90">
                  Suspected histamine trigger
                </p>
                {row.notes && (
                  <p className="mt-1 text-sm text-slate-400">{row.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
