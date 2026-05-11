"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import PulseStrip from "@/components/planner/PulseStrip";
import MorningRoutine from "@/components/planner/MorningRoutine";
import HydrationTracker from "@/components/planner/HydrationTracker";
import LogEpisodeFab from "@/components/planner/LogEpisodeFab";
import ShowerTracker from "@/components/planner/ShowerTracker";
import MovementTracker from "@/components/planner/MovementTracker";
import DueMedicationsChecklist from "@/components/planner/DueMedicationsChecklist";
import MedicationManager from "@/components/planner/MedicationManager";
import SymptomCanvas from "@/components/journal/SymptomCanvas";
import TiakiFirstTimeMedicationSetup from "@/components/home/TiakiFirstTimeMedicationSetup";
import TiakiHomeWeatherSection from "@/components/home/TiakiHomeWeatherSection";
import QuickRelief from "@/components/home/QuickRelief";
import WelcomeWizard from "@/components/WelcomeWizard";
import DoseAdjustmentModal, {
  type DoseModalTab,
} from "@/components/planner/DoseAdjustmentModal";
import QuickDoseEditModal from "@/components/planner/QuickDoseEditModal";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { qk } from "@/lib/query-keys";
import type { DailyLogEntry, EpisodeEntry } from "@/lib/types";
import { persistDailyLogToSupabase } from "@/lib/supabase/daily-logs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  atmosphericPressureFooter,
  fetchAndLogWeather,
} from "@/lib/weather";
import type { SavedMedication } from "@/lib/seed-medications";
import {
  isBaselinesComplete,
  isWelcomeWizardComplete,
  loadBaselines,
  type BaselinesProfile,
} from "@/lib/baselines-storage";

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatLongDate(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function MinimalHomeDashboard() {
  const qc = useQueryClient();
  const [displayFirstName, setDisplayFirstName] = useState("");
  const [episodeSketchOpen, setEpisodeSketchOpen] = useState(false);
  const [episodeFabOpen, setEpisodeFabOpen] = useState(false);
  const [quickAdjustMed, setQuickAdjustMed] = useState<SavedMedication | null>(
    null,
  );
  const [doseModalMed, setDoseModalMed] = useState<SavedMedication | null>(
    null,
  );
  const [doseModalTab, setDoseModalTab] = useState<DoseModalTab>("adjust");
  const [baselines, setBaselines] = useState<BaselinesProfile>(loadBaselines);
  const [baselinesPromptVisible, setBaselinesPromptVisible] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDisplayFirstName(
        window.localStorage.getItem("tiaki-display-name")?.trim() ?? "",
      );
    } catch {
      setDisplayFirstName("");
    }
  }, []);

  useEffect(() => {
    setBaselines(loadBaselines());
    setBaselinesPromptVisible(!isBaselinesComplete());
    const onBaselines = () => {
      setBaselines(loadBaselines());
      setBaselinesPromptVisible(!isBaselinesComplete());
    };
    window.addEventListener("tiaki-baselines-updated", onBaselines);
    return () =>
      window.removeEventListener("tiaki-baselines-updated", onBaselines);
  }, []);

  useEffect(() => {
    setWelcomeOpen(!isWelcomeWizardComplete());
  }, []);

  function openDoseModal(m: SavedMedication, tab: DoseModalTab) {
    setDoseModalTab(tab);
    if (tab === "history") {
      setQuickAdjustMed(null);
      setDoseModalMed(m);
    } else {
      setDoseModalMed(null);
      setQuickAdjustMed(m);
    }
  }

  const logEpisodeAndOpenSketch = useMutation({
    mutationFn: async (payload: Omit<EpisodeEntry, "id" | "recordedAt">) => {
      const snap = await fetchAndLogWeather().catch(() => null);
      const recordedAt = new Date().toISOString();
      let notes = `Episode log (${recordedAt}).\n${payload.description}`;
      notes += `\nCompression garment: ${payload.compressionGarment ? "yes" : "no"}`;
      notes += `\nAbdominal binder: ${payload.abdominalBinder ? "yes" : "no"}`;
      if (snap) {
        const line = atmosphericPressureFooter(snap.pressureHpa);
        if (line) notes += `\n${line}`;
      }
      const marker: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt,
        category: "other",
        label: "Episode log",
        notes,
      };
      const episode: EpisodeEntry = {
        id: crypto.randomUUID(),
        recordedAt,
        description: payload.description,
        painRegions: payload.painRegions,
        compressionGarment: payload.compressionGarment,
        abdominalBinder: payload.abdominalBinder,
      };
      const sb = getSupabaseBrowserClient();
      if (sb) {
        const ok = await persistDailyLogToSupabase(marker);
        if (!ok) throw new Error("Could not save episode.");
      }
      return { marker, episode };
    },
    onSuccess: ({ marker, episode }) => {
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        marker,
        ...prev,
      ]);
      qc.setQueryData<EpisodeEntry[]>(qk.episodes, (prev = []) => [
        episode,
        ...prev,
      ]);
      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
      setEpisodeSketchOpen(true);
    },
  });

  return (
    <div className="space-y-10 pb-10">
      {welcomeOpen === true && (
        <WelcomeWizard onComplete={() => setWelcomeOpen(false)} />
      )}

      <TiakiHomeWeatherSection />

      {baselinesPromptVisible && (
        <aside
          role="status"
          className="rounded-2xl border-4 border-violet-800 bg-violet-100 px-5 py-5 shadow-md"
        >
          <p className="text-xl font-black leading-snug text-slate-950">
            Personalize your daily goals
          </p>
          <p className="mt-2 text-base font-semibold text-slate-800">
            Set target water, salt, and typical symptoms so your home progress
            bars match your care plan.
          </p>
          <Link
            href="/profile-setup"
            className="mt-4 inline-flex min-h-[56px] items-center justify-center rounded-2xl border-4 border-black bg-white px-6 text-lg font-black uppercase tracking-wide text-slate-950 shadow-sm transition hover:bg-slate-50"
          >
            Open profile setup
          </Link>
        </aside>
      )}

      <div className="rounded-2xl border-4 border-black bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-800 px-5 py-6 shadow-xl">
        <p className="text-[11px] font-black uppercase tracking-[0.4em] text-white/90">
          Tiaki
        </p>
        <p className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Your daily care companion
        </p>
        <p className="mt-2 max-w-xl text-base font-semibold leading-snug text-white/95">
          Medications, routines, vitals, and quick logs in one calm,
          high-contrast screen.
        </p>
      </div>

      <TiakiFirstTimeMedicationSetup />

      <header className="space-y-1 border-b-2 border-slate-900 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {displayFirstName
            ? `${greeting()}, ${displayFirstName}`
            : greeting()}
        </h1>
        <p className="text-lg font-medium text-slate-700">{formatLongDate()}</p>
      </header>

      <QuickRelief />

      <MorningRoutine />

      <section aria-labelledby="daily-pulse-heading" className="space-y-4">
        <h2
          id="daily-pulse-heading"
          className="text-xs font-bold uppercase tracking-[0.25em] text-slate-900"
        >
          Daily pulse
        </h2>
        <PulseStrip />
        <HydrationTracker
          compact
          waterGoalOz={baselines.targetWaterOz}
          sodiumGoalMg={baselines.targetSodiumMg}
        />
        <Link
          href="/vault#side-effect-tracker"
          className="flex min-h-[56px] w-full items-center justify-center rounded-2xl border-4 border-violet-800 bg-violet-600 px-5 py-4 text-lg font-black uppercase tracking-wide text-white shadow-md transition hover:bg-violet-700"
        >
          Track Side Effects
        </Link>
      </section>

      <ShowerTracker />

      <MovementTracker />

      <section aria-labelledby="quick-actions-heading" className="space-y-4">
        <h2
          id="quick-actions-heading"
          className="text-xs font-bold uppercase tracking-[0.25em] text-slate-900"
        >
          Quick actions
        </h2>
        <button
          type="button"
          onClick={() => setEpisodeFabOpen(true)}
          disabled={logEpisodeAndOpenSketch.isPending}
          className="flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl border-4 border-red-800 bg-red-600 px-6 py-5 text-xl font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-red-700 active:scale-[0.99] disabled:opacity-60"
        >
          <ClipboardList className="h-9 w-9 shrink-0" aria-hidden />
          Log episode
        </button>
        <p className="text-center text-base font-medium text-slate-700">
          Describe what happened, note compression gear, then save — opens the
          body map with barometric context when available.
        </p>
        {logEpisodeAndOpenSketch.isError &&
          logEpisodeAndOpenSketch.error instanceof Error && (
            <p
              className="text-center text-base font-bold text-red-700"
              role="alert"
            >
              {logEpisodeAndOpenSketch.error.message}
            </p>
          )}
      </section>

      <details className="group rounded-2xl border-4 border-black bg-white [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-xl font-black text-slate-900">
          <span>Medication checklist</span>
          <ChevronDown
            className="h-8 w-8 shrink-0 text-slate-900 transition group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="space-y-6 border-t-4 border-slate-200 px-3 pb-6 pt-5 sm:px-4">
          <DueMedicationsChecklist />
          <MedicationManager
            embedded
            onOpenDoseModal={openDoseModal}
            onOpenAdvancedMedication={(m) => {
              setQuickAdjustMed(null);
              setDoseModalTab("adjust");
              setDoseModalMed(m);
            }}
          />
          <Link
            href="/meds"
            className="flex min-h-[56px] w-full items-center justify-center rounded-2xl border-4 border-black bg-white py-3 text-lg font-bold uppercase tracking-wide text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            Full medications page
          </Link>
        </div>
      </details>

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

      <LogEpisodeFab
        open={episodeFabOpen}
        onClose={() => setEpisodeFabOpen(false)}
        painRegions={{}}
        onSubmit={(payload) => {
          setEpisodeFabOpen(false);
          logEpisodeAndOpenSketch.mutate(payload);
        }}
      />

      <Sheet open={episodeSketchOpen} onOpenChange={setEpisodeSketchOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto border-t-4 border-black bg-white"
        >
          <SheetHeader className="border-b border-slate-200 pb-4">
            <SheetTitle className="text-xl font-black text-slate-900">
              Body drawing
            </SheetTitle>
            <SheetDescription className="text-base font-medium text-slate-700">
              Trace where symptoms are strongest; saves go to your daily log for
              specialists.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-8 py-6">
            <SymptomCanvas side="front" />
            <SymptomCanvas side="back" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
