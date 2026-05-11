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
import type { ScheduledDose } from "@/lib/medication-schedule";
import { fetchMergedMedicationDoses } from "@/lib/merge-medication-doses";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import { getActiveMedications } from "@/lib/medication-active";
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
import { useState } from "react";
import {
  atmosphericPressureFooter,
  fetchAndLogWeather,
} from "@/lib/weather";
import { getEnvironmentSnapshot } from "@/lib/environment-snapshot";

const MOOD_SCALE: { value: MoodEntry["mood"]; label: string }[] = [
  { value: 5, label: "Great" },
  { value: 4, label: "Good" },
  { value: 3, label: "Okay" },
  { value: 2, label: "Low" },
  { value: 1, label: "Crisis" },
];

const MOOD_ICONS = [Sparkles, Smile, Cloud, CloudRain, AlertTriangle] as const;

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

/** Minimal light-mode pulse row for the home dashboard (one tap = save). */
export default function PulseStrip() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
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

  const saveMood = useMutation({
    mutationFn: async (mood: MoodEntry["mood"]) => {
      let snap = null;
      if (mood === 1) {
        snap =
          (await fetchAndLogWeather().catch(() => null)) ??
          getEnvironmentSnapshot();
      }
      const row: MoodEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        mood,
      };
      if (mood === 1 && snap) {
        const line = atmosphericPressureFooter(snap.pressureHpa);
        if (line) row.note = line;
      }
      await persistMoodToSupabase(row);
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<MoodEntry[]>(qk.moods, (prev = []) => [row, ...prev]);
      setToast("Mood saved");
      window.setTimeout(() => setToast(null), 1800);
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
        const candidate = findRecentDoseContext(
          doses,
          getActiveMedications(medications),
        );
        if (candidate) {
          setSideEffectPrompt({ candidate, trigger: "mood_crisis" });
        }
      }
    },
  });

  const saveBrainFog = useMutation({
    mutationFn: async (score: BrainFogEntry["score"]) => {
      let snap = null;
      if (score >= 8) {
        snap =
          (await fetchAndLogWeather().catch(() => null)) ??
          getEnvironmentSnapshot();
      }
      const row: BrainFogEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        score,
      };
      if (score >= 8 && snap) {
        const line = atmosphericPressureFooter(snap.pressureHpa);
        if (line) row.note = line;
      }
      await persistBrainFogToSupabase(row);
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<BrainFogEntry[]>(qk.brainFog, (prev = []) => [
        row,
        ...prev,
      ]);
      setToast("Brain fog saved");
      window.setTimeout(() => setToast(null), 1800);
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
        const candidate = findRecentDoseContext(
          doses,
          getActiveMedications(medications),
        );
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
      setToast(`Linked to ${log.medicationName}`);
      window.setTimeout(() => setToast(null), 2200);
    },
  });

  return (
    <div className="rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-sm">
      <p
        id="pulse-mood"
        className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900"
      >
        Mood
      </p>
      <div
        className="mt-3 flex justify-between gap-1 overflow-x-auto pb-1"
        role="group"
        aria-labelledby="pulse-mood"
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
              className="flex min-h-[88px] min-w-[3.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-slate-900 bg-white py-2 transition active:scale-[0.97] disabled:opacity-50"
            >
              <Icon className="h-9 w-9 text-sky-700" aria-hidden />
              <span className="text-[10px] font-semibold uppercase text-slate-800">
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <p
        id="pulse-fog"
        className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-slate-900"
      >
        Brain fog
      </p>
      <div
        className="mt-3 flex justify-between gap-1 overflow-x-auto pb-1"
        role="group"
        aria-labelledby="pulse-fog"
      >
        {BRAIN_FOG_STEPS.map(({ score, label }, i) => {
          const Icon = BRAIN_ICONS[i];
          return (
            <button
              key={score}
              type="button"
              disabled={saveBrainFog.isPending}
              onClick={() => saveBrainFog.mutate(score)}
              title={label}
              aria-label={`Log brain fog: ${label}`}
              className="flex min-h-[88px] min-w-[3.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-slate-900 bg-white py-2 transition active:scale-[0.97] disabled:opacity-50"
            >
              <Icon className="h-9 w-9 text-violet-700" aria-hidden />
              <span className="text-center text-[10px] font-semibold uppercase leading-tight text-slate-800">
                {label}
              </span>
            </button>
          );
        })}
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
        <p
          className="mt-4 rounded-lg border-2 border-emerald-700 bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-950"
          role="status"
        >
          {toast}
        </p>
      )}
    </div>
  );
}
