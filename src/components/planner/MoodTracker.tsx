"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  TaperPlan,
  TaperSensitivityEvent,
} from "@/lib/medication-profile-types";
import { hasAnyActiveTaperOnDate } from "@/lib/taper-plan";
import {
  AlertTriangle,
  Brain,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSun,
  Eye,
  Smile,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ScheduledDose } from "@/lib/medication-schedule";
import { fetchMergedMedicationDoses } from "@/lib/merge-medication-doses";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import {
  findRecentDoseContext,
  type RecentDoseContext,
} from "@/lib/recent-dose-context";
import {
  persistBrainFogToSupabase,
  persistMoodToSupabase,
  persistSideEffectLogToSupabase,
} from "@/lib/supabase/wellness-side-effects";
import { loadTaperPlansMap } from "@/lib/supabase/medication-history";
import type { BrainFogEntry, MoodEntry, SideEffectLog } from "@/lib/types";
import ContextualSideEffect from "./ContextualSideEffect";

/** Mood: Great (5) … Crisis (1) — left to right */
const MOOD_SCALE: { value: MoodEntry["mood"]; label: string }[] = [
  { value: 5, label: "Great" },
  { value: 4, label: "Good" },
  { value: 3, label: "Okay" },
  { value: 2, label: "Low" },
  { value: 1, label: "Crisis" },
];

const MOOD_ICONS = [Sparkles, Smile, Cloud, CloudRain, AlertTriangle] as const;

/** Brain fog: five steps mapped to scores 2–10 (worst = Total fog). */
const BRAIN_FOG_STEPS: {
  score: BrainFogEntry["score"];
  label: string;
}[] = [
  { score: 2, label: "Clear" },
  { score: 4, label: "Light" },
  { score: 6, label: "Moderate" },
  { score: 8, label: "Heavy" },
  { score: 10, label: "Total fog" },
];

const BRAIN_ICONS = [Eye, CloudSun, Cloud, CloudFog, Brain] as const;

function formatSavedAt(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MoodTracker() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [sideEffectPrompt, setSideEffectPrompt] = useState<{
    candidate: RecentDoseContext;
    trigger: "mood_crisis" | "brain_fog_total";
  } | null>(null);

  const { data: medications = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: fetchMedicationsQuery,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  useQuery({
    queryKey: qk.taperPlans,
    queryFn: loadTaperPlansMap,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: doses = [] } = useQuery({
    queryKey: qk.medicationTimeline,
    queryFn: (): Promise<ScheduledDose[]> =>
      fetchMergedMedicationDoses(qc),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24 * 7,
  });

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const saveMood = useMutation({
    mutationFn: async (mood: MoodEntry["mood"]) => {
      const row: MoodEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        mood,
      };
      await persistMoodToSupabase(row);
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<MoodEntry[]>(qk.moods, (prev = []) => [row, ...prev]);
      setToast(`Log saved at ${formatSavedAt(new Date(row.recordedAt))}`);
      setPulseKey((k) => k + 1);
      setSideEffectPrompt(null);
      if (row.mood === 1) {
        const plans =
          qc.getQueryData<Record<string, TaperPlan>>(qk.taperPlans) ?? {};
        const { active, names } = hasAnyActiveTaperOnDate(plans, new Date());
        if (active && names.length > 0) {
          const ev: TaperSensitivityEvent = {
            id: crypto.randomUUID(),
            recordedAt: row.recordedAt,
            kind: "mood_crisis",
            medicationNamesInTaper: names,
            note: `Crisis mood during active taper (${names.join(", ")}).`,
          };
          qc.setQueryData<TaperSensitivityEvent[]>(
            qk.taperSensitivityEvents,
            (prev = []) => [ev, ...prev]
          );
        }
        const candidate = findRecentDoseContext(doses, medications);
        if (candidate) {
          setSideEffectPrompt({ candidate, trigger: "mood_crisis" });
        }
      }
    },
  });

  const saveBrainFog = useMutation({
    mutationFn: async (score: BrainFogEntry["score"]) => {
      const row: BrainFogEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        score,
      };
      await persistBrainFogToSupabase(row);
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<BrainFogEntry[]>(qk.brainFog, (prev = []) => [
        row,
        ...prev,
      ]);
      setToast(`Log saved at ${formatSavedAt(new Date(row.recordedAt))}`);
      setPulseKey((k) => k + 1);
      setSideEffectPrompt(null);
      if (row.score === 10) {
        const plans =
          qc.getQueryData<Record<string, TaperPlan>>(qk.taperPlans) ?? {};
        const { active, names } = hasAnyActiveTaperOnDate(plans, new Date());
        if (active && names.length > 0) {
          const ev: TaperSensitivityEvent = {
            id: crypto.randomUUID(),
            recordedAt: row.recordedAt,
            kind: "brain_fog_total",
            medicationNamesInTaper: names,
            note: `Severe brain fog during active taper (${names.join(", ")}).`,
          };
          qc.setQueryData<TaperSensitivityEvent[]>(
            qk.taperSensitivityEvents,
            (prev = []) => [ev, ...prev]
          );
        }
        const candidate = findRecentDoseContext(doses, medications);
        if (candidate) {
          setSideEffectPrompt({ candidate, trigger: "brain_fog_total" });
        }
      }
    },
  });

  const linkSideEffect = useMutation({
    mutationFn: async (payload: {
      candidate: RecentDoseContext;
      trigger: "mood_crisis" | "brain_fog_total";
    }) => {
      const med =
        medications.find(
          (m) =>
            m.name.toLowerCase() === payload.candidate.medicationName.toLowerCase()
        ) ?? null;
      const medicationId = med?.id ?? payload.candidate.medicationId;
      const medicationName = med?.name ?? payload.candidate.medicationName;

      const symptoms: string[] =
        payload.trigger === "mood_crisis"
          ? ["Crisis mood", "Suspected reaction"]
          : ["Brain fog", "Total fog", "Suspected reaction"];

      const log: SideEffectLog = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        medicationId,
        medicationName,
        symptoms,
      };
      await persistSideEffectLogToSupabase(log);
      return log;
    },
    onSuccess: (log) => {
      qc.setQueryData<SideEffectLog[]>(qk.sideEffectLogs, (prev = []) => [
        log,
        ...prev,
      ]);
      setSideEffectPrompt(null);
      setToast(`Linked to ${log.medicationName} · ${formatSavedAt(new Date(log.recordedAt))}`);
    },
  });

  return (
    <section className="relative overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/40 ring-1 ring-sky-500/15">
      <div
        key={pulseKey}
        className="pointer-events-none absolute inset-0 opacity-[0.35] motion-safe:animate-pulse-strip"
        aria-hidden
      />
      <div className="relative px-4 pb-4 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-sky-400/90">
          Pulse check-in
        </p>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Mood · Great to crisis
          </p>
          <div
            className="mt-3 flex items-center justify-between gap-1 overflow-x-auto pb-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Mood scale"
          >
            {MOOD_SCALE.map(({ value, label }, i) => {
              const Icon = MOOD_ICONS[i];
              return (
                <button
                  key={value}
                  type="button"
                  disabled={saveMood.isPending}
                  onClick={() => saveMood.mutate(value)}
                  title={label}
                  aria-label={`Log mood: ${label}`}
                  className="group flex min-w-[4.25rem] flex-1 flex-col items-center gap-2 rounded-2xl border border-slate-300 bg-slate-100/80 px-2 py-3 shadow-inner transition hover:border-sky-500/50 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 ring-1 ring-white/10 transition group-active:scale-95">
                    <Icon className="h-8 w-8 text-sky-300" aria-hidden />
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 border-t border-slate-300 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Brain fog · Clear to total fog
          </p>
          <div
            className="mt-3 flex items-center justify-between gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Brain fog scale"
          >
            {BRAIN_FOG_STEPS.map(({ score, label }, i) => {
              const Icon = BRAIN_ICONS[i];
              const foggy =
                i >= 3 ? "text-violet-300" : "text-indigo-300";
              return (
                <button
                  key={score}
                  type="button"
                  disabled={saveBrainFog.isPending}
                  onClick={() => saveBrainFog.mutate(score)}
                  title={label}
                  aria-label={`Log brain fog: ${label}`}
                  className="group flex min-w-[4.25rem] flex-1 flex-col items-center gap-2 rounded-2xl border border-slate-300 bg-slate-100/80 px-2 py-3 shadow-inner transition hover:border-violet-500/45 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:opacity-50"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 ring-1 ring-white/10 transition group-active:scale-95">
                    <Icon className={`h-8 w-8 ${foggy}`} aria-hidden />
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <ContextualSideEffect
          open={!!sideEffectPrompt}
          candidate={sideEffectPrompt?.candidate ?? null}
          trigger={sideEffectPrompt?.trigger ?? "mood_crisis"}
          onDismiss={() => setSideEffectPrompt(null)}
          onConfirmYes={() => {
            if (!sideEffectPrompt) return;
            linkSideEffect.mutate({
              candidate: sideEffectPrompt.candidate,
              trigger: sideEffectPrompt.trigger,
            });
          }}
        />

        {toast && (
          <div
            className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[85] max-w-[min(90vw,20rem)] -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-950/95 px-5 py-2.5 text-center text-sm font-medium text-emerald-50 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-800/50"
            role="status"
          >
            {toast}
          </div>
        )}
      </div>
    </section>
  );
}
