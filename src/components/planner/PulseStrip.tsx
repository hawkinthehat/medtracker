"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  TaperPlan,
  TaperSensitivityEvent,
} from "@/lib/medication-profile-types";
import { hasAnyActiveTaperOnDate } from "@/lib/taper-plan";
import { AlertTriangle, Cloud, CloudRain, Smile, Sparkles } from "lucide-react";
import type { ScheduledDose } from "@/lib/medication-schedule";
import { fetchMergedMedicationDoses } from "@/lib/merge-medication-doses";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import { getActiveMedications } from "@/lib/medication-active";
import {
  findRecentDoseContext,
  type RecentDoseContext,
} from "@/lib/recent-dose-context";
import { persistMoodToSupabase, persistSideEffectLogToSupabase } from "@/lib/supabase/wellness-side-effects";
import { loadTaperPlansMap } from "@/lib/supabase/medication-history";
import type { MoodEntry, SideEffectLog } from "@/lib/types";
import ContextualSideEffect from "./ContextualSideEffect";
import { useState } from "react";
import {
  atmosphericPressureFooter,
  fetchAndLogWeather,
} from "@/lib/weather";
import { getEnvironmentSnapshot } from "@/lib/environment-snapshot";
import { TOAST_MOOD, toastLinkedMedication } from "@/lib/educational-toasts";

const MOOD_SCALE: { value: MoodEntry["mood"]; label: string }[] = [
  { value: 5, label: "Great" },
  { value: 4, label: "Good" },
  { value: 3, label: "Okay" },
  { value: 2, label: "Low" },
  { value: 1, label: "Crisis" },
];

const MOOD_ICONS = [Sparkles, Smile, Cloud, CloudRain, AlertTriangle] as const;

/** Mood-only pulse row. Brain fog quick-taps live under Symptom Matrix on home. */
export default function PulseStrip() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [sideEffectPrompt, setSideEffectPrompt] =
    useState<RecentDoseContext | null>(null);

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
      const ok = await persistMoodToSupabase(row);
      if (!ok) {
        throw new Error(
          "Connect Supabase to save mood — tap again after configuring.",
        );
      }
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<MoodEntry[]>(qk.moods, (prev = []) => [row, ...prev]);
      setToast(TOAST_MOOD);
      window.setTimeout(() => setToast(null), 4000);
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
            (prev = []) => [ev, ...prev],
          );
        }
        const candidate = findRecentDoseContext(
          doses,
          getActiveMedications(medications),
        );
        if (candidate) {
          setSideEffectPrompt(candidate);
        }
      }
    },
    onError: (e: unknown) => {
      setErrorToast(e instanceof Error ? e.message : "Could not save mood.");
      window.setTimeout(() => setErrorToast(null), 4200);
    },
  });

  const linkSideEffect = useMutation({
    mutationFn: async (candidate: RecentDoseContext) => {
      const med =
        medications.find(
          (m) =>
            m.name.toLowerCase() === candidate.medicationName.toLowerCase(),
        ) ?? null;
      const medicationId = med?.id ?? candidate.medicationId;
      const medicationName = med?.name ?? candidate.medicationName;

      const log: SideEffectLog = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        medicationId,
        medicationName,
        symptoms: ["Crisis mood", "Suspected reaction"],
      };
      const ok = await persistSideEffectLogToSupabase(log);
      if (!ok) {
        throw new Error(
          "Could not save side-effect link — check Supabase and try again.",
        );
      }
      return log;
    },
    onSuccess: (log) => {
      qc.setQueryData<SideEffectLog[]>(qk.sideEffectLogs, (prev = []) => [
        log,
        ...prev,
      ]);
      setSideEffectPrompt(null);
      setToast(toastLinkedMedication(log.medicationName));
      window.setTimeout(() => setToast(null), 4000);
    },
    onError: (e: unknown) => {
      setErrorToast(
        e instanceof Error ? e.message : "Could not save side-effect link.",
      );
      window.setTimeout(() => setErrorToast(null), 4200);
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
              disabled={saveMood.isPending || linkSideEffect.isPending}
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

      <ContextualSideEffect
        open={!!sideEffectPrompt}
        candidate={sideEffectPrompt}
        onDismiss={() => setSideEffectPrompt(null)}
        onConfirmYes={() => {
          if (!sideEffectPrompt) return;
          linkSideEffect.mutate(sideEffectPrompt);
        }}
      />

      {toast && (
        <p
          className="mt-4 rounded-lg border-2 border-emerald-700 bg-emerald-50 px-3 py-3 text-center text-[18px] font-semibold leading-snug text-emerald-950"
          role="status"
        >
          {toast}
        </p>
      )}

      {errorToast && (
        <p
          className="mt-4 rounded-lg border-2 border-red-800 bg-red-50 px-3 py-3 text-center text-base font-bold leading-snug text-red-950"
          role="alert"
        >
          {errorToast}
        </p>
      )}
    </div>
  );
}
