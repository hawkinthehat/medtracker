"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type {
  DailyLogEntry,
  EpisodeEntry,
  MoodEntry,
  PainMapSnapshot,
  PainRegionId,
  VitalRow,
} from "@/lib/types";
import PainMapBody, { cyclePainLevel, PAIN_LABELS } from "./PainMapBody";
import LogEpisodeFab from "./LogEpisodeFab";
import MoodVitalsTimeline from "./MoodVitalsTimeline";
import MoodTracker from "./MoodTracker";
import MedicationManager from "./MedicationManager";
import TodayMedicationStrip from "./TodayMedicationStrip";
import SjogrensCareCard from "./SjogrensCareCard";
import {
  Apple,
  ChevronDown,
  ClipboardList,
  Dumbbell,
  HeartPulse,
  LayoutGrid,
  Pill,
} from "lucide-react";
import { useMemo, useState } from "react";
import DoseAdjustmentModal, {
  type DoseModalTab,
} from "./DoseAdjustmentModal";
import type { SavedMedication } from "@/lib/seed-medications";

export default function MedicalPlannerDashboard() {
  const qc = useQueryClient();
  const [painRegions, setPainRegions] = useState<
    Partial<Record<PainRegionId, number>>
  >({});
  const [episodeOpen, setEpisodeOpen] = useState(false);
  const [doseModalMed, setDoseModalMed] = useState<SavedMedication | null>(
    null
  );
  const [doseModalTab, setDoseModalTab] = useState<DoseModalTab>("adjust");
  const [medManagerExpanded, setMedManagerExpanded] = useState(false);

  function openDoseModal(med: SavedMedication, tab: DoseModalTab) {
    setDoseModalTab(tab);
    setDoseModalMed(med);
  }

  const { data: dailyLogs = [] } = useQuery({
    queryKey: qk.dailyLogs,
    queryFn: async (): Promise<DailyLogEntry[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: vitals = [] } = useQuery({
    queryKey: qk.vitals,
    queryFn: async (): Promise<VitalRow[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: painSnapshots = [] } = useQuery({
    queryKey: qk.painSnapshots,
    queryFn: async (): Promise<PainMapSnapshot[]> => [],
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

  const { data: episodes = [] } = useQuery({
    queryKey: qk.episodes,
    queryFn: async (): Promise<EpisodeEntry[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const addPainSnapshot = useMutation({
    mutationFn: async (s: PainMapSnapshot) => s,
    onSuccess: (snap) => {
      qc.setQueryData<PainMapSnapshot[]>(qk.painSnapshots, (prev = []) => [
        snap,
        ...prev,
      ]);
    },
  });

  const addEpisode = useMutation({
    mutationFn: async (e: EpisodeEntry) => e,
    onSuccess: (row) => {
      qc.setQueryData<EpisodeEntry[]>(qk.episodes, (prev = []) => [
        row,
        ...prev,
      ]);
    },
  });

  const addMood = useMutation({
    mutationFn: async (m: MoodEntry) => m,
    onSuccess: (row) => {
      qc.setQueryData<MoodEntry[]>(qk.moods, (prev = []) => [row, ...prev]);
    },
  });

  const foodExercise = useMemo(
    () =>
      dailyLogs.filter(
        (d) => d.category === "food" || d.category === "activity"
      ),
    [dailyLogs]
  );

  function savePainSnapshot() {
    const hasAny = Object.values(painRegions).some((v) => (v ?? 0) > 0);
    if (!hasAny) return;
    addPainSnapshot.mutate({
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      regions: { ...painRegions },
    });
  }

  function onRegionPress(id: PainRegionId) {
    setPainRegions((prev) => ({
      ...prev,
      [id]: cyclePainLevel(prev[id]),
    }));
  }

  return (
    <>
      <div className="space-y-6 pb-4">
        <header className="border-b border-dashed border-slate-700 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-500">
                Weekly planner
              </p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-50">
                <LayoutGrid
                  className="h-7 w-7 shrink-0 text-sky-400"
                  aria-hidden
                />
                Care planner
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                Mood check-in and quick actions up top, today&apos;s doses and
                planner sections follow — open the medication manager at the
                bottom when you need Smart Add or dose edits.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Link
                href="/emergency"
                className="rounded-lg border border-red-800/60 bg-red-950/35 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-100 hover:bg-red-950/50"
              >
                Medical ID
              </Link>
              <Link
                href="/daily"
                className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100 hover:bg-amber-950/50"
              >
                Daily summary (MCAS)
              </Link>
            </div>
          </div>
        </header>

        <MoodTracker />

        <section aria-label="Quick actions" className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-500">
            Quick actions
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setEpisodeOpen(true)}
              className="flex min-h-[112px] flex-col items-center justify-center gap-3 rounded-2xl border border-red-900/50 bg-red-950/35 px-4 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-red-950/40 transition hover:border-red-700/60 hover:bg-red-950/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
            >
              <ClipboardList
                className="h-10 w-10 shrink-0 text-red-300"
                aria-hidden
              />
              <span className="text-base font-bold tracking-tight text-red-50">
                Log Episode
              </span>
            </button>
            <Link
              href="/vitals"
              className="flex min-h-[112px] flex-col items-center justify-center gap-3 rounded-2xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-emerald-950/35 transition hover:border-emerald-700/55 hover:bg-emerald-950/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <HeartPulse
                className="h-10 w-10 shrink-0 text-emerald-300"
                aria-hidden
              />
              <span className="text-base font-bold tracking-tight text-emerald-50">
                BP Test
              </span>
            </Link>
          </div>
        </section>

        <TodayMedicationStrip
          onSelectMedication={(m) => openDoseModal(m, "adjust")}
        />

        <SjogrensCareCard />

        <PlannerSection
            title="Food & exercise"
            icon={
              <span className="flex items-center gap-1" aria-hidden>
                <Apple className="h-4 w-4 text-lime-400" />
                <Dumbbell className="h-3.5 w-3.5 text-slate-400" />
              </span>
            }
            action={
              <Link
                href="/daily"
                className="text-xs font-semibold text-sky-400 hover:text-sky-300"
              >
                Log / timeline →
              </Link>
            }
          >
            <ul className="space-y-2">
              {foodExercise.length === 0 && (
                <li className="text-sm text-slate-500">
                  Log meals and movement from Daily summary or here via quick
                  notes on your phone.
                </li>
              )}
              {foodExercise.slice(0, 6).map((d) => (
                <li
                  key={d.id}
                  className="border-b border-slate-800/80 py-2 last:border-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {d.category}
                    </span>
                    <time
                      className="font-mono text-[10px] text-slate-600"
                      dateTime={d.recordedAt}
                    >
                      {new Date(d.recordedAt).toLocaleDateString()}
                    </time>
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{d.label}</p>
                </li>
              ))}
            </ul>
          </PlannerSection>

        <PlannerSection
          title="Pain map"
          className="md:col-span-2"
          icon={
            <span className="text-rose-400" aria-hidden>
              ◎
            </span>
          }
        >
          <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:justify-between">
            <PainMapBody
              regions={painRegions}
              onRegionPress={onRegionPress}
            />
            <div className="flex flex-1 flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 lg:max-w-xs">
              <p className="text-xs leading-relaxed text-slate-500">
                Active regions:{" "}
                <span className="text-slate-300">
                  {Object.entries(painRegions)
                    .filter(([, v]) => (v ?? 0) > 0)
                    .map(([k]) => PAIN_LABELS[k as PainRegionId])
                    .join(", ") || "None"}
                </span>
              </p>
              <button
                type="button"
                onClick={savePainSnapshot}
                className="rounded-xl bg-rose-900/50 py-2.5 text-sm font-semibold text-rose-100 ring-1 ring-rose-800/60 hover:bg-rose-900/70"
              >
                Save pain snapshot
              </button>
              <button
                type="button"
                onClick={() => setPainRegions({})}
                className="text-xs font-medium text-slate-500 hover:text-slate-400"
              >
                Clear map
              </button>
            </div>
          </div>
        </PlannerSection>

        <PlannerSection
          title="Strip — mood & vitals"
          icon={<span className="text-sky-400">▬</span>}
        >
          <MoodVitalsTimeline
            vitals={vitals}
            moods={moods}
            episodes={episodes}
            painSnapshots={painSnapshots}
            showMoodButtons={false}
            onLogMood={(mood) =>
              addMood.mutate({
                id: crypto.randomUUID(),
                recordedAt: new Date().toISOString(),
                mood,
              })
            }
          />
        </PlannerSection>

        <section className="overflow-hidden rounded-xl border border-slate-600 bg-slate-900/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/20">
          <button
            type="button"
            onClick={() => setMedManagerExpanded((v) => !v)}
            aria-expanded={medManagerExpanded}
            id="med-manager-accordion-trigger"
            aria-controls="med-manager-panel"
            className="flex w-full items-center justify-between gap-3 bg-slate-950/40 px-4 py-3.5 text-left transition hover:bg-slate-900/55"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-950/50 ring-1 ring-violet-800/50">
                <Pill
                  className="h-5 w-5 text-violet-300"
                  aria-hidden
                />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-500">
                  Med manager
                </p>
                <p className="truncate text-sm font-semibold text-slate-100">
                  Medications &amp; Smart Add
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${
                medManagerExpanded ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
          <div
            id="med-manager-panel"
            role="region"
            aria-labelledby="med-manager-accordion-trigger"
            className={`grid border-t border-slate-800/90 transition-[grid-template-rows] duration-300 ease-out ${
              medManagerExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="px-4 pb-4 pt-1">
                <MedicationManager
                  embedded
                  onOpenDoseModal={openDoseModal}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
      <DoseAdjustmentModal
        med={doseModalMed}
        open={!!doseModalMed}
        initialTab={doseModalTab}
        onClose={() => setDoseModalMed(null)}
      />
      <LogEpisodeFab
        open={episodeOpen}
        onClose={() => setEpisodeOpen(false)}
        painRegions={painRegions}
        onSubmit={(payload) => {
          addEpisode.mutate({
            id: crypto.randomUUID(),
            recordedAt: new Date().toISOString(),
            description: payload.description,
            painRegions: payload.painRegions,
          });
        }}
      />
    </>
  );
}

function PlannerSection({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-slate-600 bg-slate-900/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/20 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-700/90 bg-slate-950/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-200">
            {title}
          </h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
