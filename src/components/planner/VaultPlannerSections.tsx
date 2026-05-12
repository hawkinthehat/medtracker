"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type {
  EpisodeEntry,
  MoodEntry,
  PainMapSnapshot,
  PainRegionId,
  VitalRow,
} from "@/lib/types";
import PainMapBody, { cyclePainLevel, PAIN_LABELS } from "./PainMapBody";
import MoodVitalsTimeline from "./MoodVitalsTimeline";
import MedicationManager from "./MedicationManager";
import SjogrensCareCard from "./SjogrensCareCard";
import { Apple, ChevronDown, Dumbbell, Pill } from "lucide-react";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";
import { useMemo, useState, type ReactNode } from "react";
import DoseAdjustmentModal, {
  type DoseModalTab,
} from "./DoseAdjustmentModal";
import QuickDoseEditModal from "./QuickDoseEditModal";
import type { SavedMedication } from "@/lib/seed-medications";

/** Charts, pain map, timelines, and full med manager — kept in Vault off the minimal home screen. */
export default function VaultPlannerSections() {
  const qc = useQueryClient();
  const [painRegions, setPainRegions] = useState<
    Partial<Record<PainRegionId, number>>
  >({});
  const [doseModalMed, setDoseModalMed] = useState<SavedMedication | null>(
    null
  );
  const [quickAdjustMed, setQuickAdjustMed] = useState<SavedMedication | null>(
    null,
  );
  const [doseModalTab, setDoseModalTab] = useState<DoseModalTab>("adjust");
  const [medManagerExpanded, setMedManagerExpanded] = useState(false);

  function openDoseModal(med: SavedMedication, tab: DoseModalTab) {
    setDoseModalTab(tab);
    if (tab === "history") {
      setQuickAdjustMed(null);
      setDoseModalMed(med);
    } else {
      setDoseModalMed(null);
      setQuickAdjustMed(med);
    }
  }

  const { data: dailyLogs = [] } = useQuery({
    queryKey: qk.dailyLogs,
    queryFn: dailyLogsQueryFn,
    staleTime: 60_000,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
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

  const addMood = useMutation({
    mutationFn: async (m: MoodEntry) => m,
    onSuccess: (row) => {
      qc.setQueryData<MoodEntry[]>(qk.moods, (prev = []) => [row, ...prev]);
    },
  });

  const foodExercise = useMemo(
    () =>
      dailyLogs.filter(
        (d) =>
          d.category === "food" ||
          d.category === "activity" ||
          d.category === "movement"
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
      <section className="rounded-2xl border-2 border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Care planner detail
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Pain map, mood strip, food logs, and medication manager — same tools as
          before, gathered here so the home screen stays minimal.
        </p>
      </section>

      <SjogrensCareCard />

      <PlannerSection
        title="Food & exercise"
        icon={
          <span className="flex items-center gap-1" aria-hidden>
            <Apple className="h-4 w-4 text-lime-600" />
            <Dumbbell className="h-3.5 w-3.5 text-slate-500" />
          </span>
        }
        action={
          <Link
            href="/daily"
            className="text-xs font-semibold text-sky-700 hover:text-sky-800"
          >
            Log / timeline →
          </Link>
        }
      >
        <ul className="space-y-2">
          {foodExercise.length === 0 && (
            <li className="text-sm text-slate-500">
              Log meals and movement from Daily summary.
            </li>
          )}
          {foodExercise.slice(0, 12).map((d) => (
            <li
              key={d.id}
              className="border-b border-slate-200 py-2 last:border-0"
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
              <p className="mt-1 text-sm text-slate-800">{d.label}</p>
            </li>
          ))}
        </ul>
      </PlannerSection>

      <PlannerSection
        title="Pain map"
        className="md:col-span-2"
        icon={
          <span className="text-rose-600" aria-hidden>
            ◎
          </span>
        }
      >
        <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PainMapBody regions={painRegions} onRegionPress={onRegionPress} />
          <div className="flex flex-1 flex-col gap-3 rounded-xl border-2 border-slate-300 bg-slate-50 p-4 lg:max-w-xs">
            <p className="text-xs leading-relaxed text-slate-600">
              Active regions:{" "}
              <span className="font-medium text-slate-900">
                {Object.entries(painRegions)
                  .filter(([, v]) => (v ?? 0) > 0)
                  .map(([k]) => PAIN_LABELS[k as PainRegionId])
                  .join(", ") || "None"}
              </span>
            </p>
            <button
              type="button"
              onClick={savePainSnapshot}
              className="rounded-xl border-2 border-rose-400 bg-rose-100 py-2.5 text-sm font-semibold text-rose-950 shadow-sm hover:bg-rose-200"
            >
              Save pain snapshot
            </button>
            <button
              type="button"
              onClick={() => setPainRegions({})}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Clear map
            </button>
          </div>
        </div>
      </PlannerSection>

      <PlannerSection
        title="Strip — mood & vitals"
        icon={<span className="text-sky-600">▬</span>}
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

      <section className="overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-sm ring-1 ring-slate-200/90">
        <button
          type="button"
          onClick={() => setMedManagerExpanded((v) => !v)}
          aria-expanded={medManagerExpanded}
          id="vault-med-manager-trigger"
          aria-controls="vault-med-manager-panel"
          className="flex w-full items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3.5 text-left transition hover:bg-slate-100/90"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 ring-1 ring-violet-200/80">
              <Pill className="h-5 w-5 text-violet-700" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-600">
                Med manager
              </p>
              <p className="truncate text-sm font-semibold text-slate-900">
                Medications &amp; Smart Add
              </p>
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-600 transition-transform duration-300 ${
              medManagerExpanded ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>
        <div
          id="vault-med-manager-panel"
          role="region"
          aria-labelledby="vault-med-manager-trigger"
          className={`grid border-t border-slate-200 transition-[grid-template-rows] duration-300 ease-out ${
            medManagerExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="px-4 pb-4 pt-1">
              <MedicationManager
                embedded
                onOpenDoseModal={openDoseModal}
                onOpenAdvancedMedication={(m) => {
                  setQuickAdjustMed(null);
                  setDoseModalTab("adjust");
                  setDoseModalMed(m);
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <QuickDoseEditModal
        med={quickAdjustMed}
        open={!!quickAdjustMed}
        onClose={() => setQuickAdjustMed(null)}
        onOpenAdvanced={(m) => {
          setQuickAdjustMed(null);
          setDoseModalTab("adjust");
          setDoseModalMed(m);
        }}
      />

      <DoseAdjustmentModal
        med={doseModalMed}
        open={!!doseModalMed}
        initialTab={doseModalTab}
        onClose={() => setDoseModalMed(null)}
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
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-sm ring-1 ring-slate-200/90 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b-2 border-slate-200 bg-slate-50/90 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-900">
            {title}
          </h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
