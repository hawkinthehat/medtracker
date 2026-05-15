"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import PulseStrip from "@/components/planner/PulseStrip";
import MorningRoutine from "@/components/planner/MorningRoutine";
import HydrationTracker from "@/components/planner/HydrationTracker";
import SaltTracker from "@/components/planner/SaltTracker";
import LogEpisodeFab from "@/components/planner/LogEpisodeFab";
import ShowerTracker from "@/components/planner/ShowerTracker";
import MovementTracker from "@/components/planner/MovementTracker";
import DueMedicationsChecklist from "@/components/planner/DueMedicationsChecklist";
import MedicationManager from "@/components/planner/MedicationManager";
import SymptomCanvas from "@/components/journal/SymptomCanvas";
import HomeDashboardTopZone from "@/components/home/HomeDashboardTopZone";
import HomeDailyActionGrid from "@/components/home/HomeDailyActionGrid";
import QuickRelief from "@/components/home/QuickRelief";
import SymptomMatrix from "@/components/home/SymptomMatrix";
import DashboardTodayCounters from "@/components/home/DashboardTodayCounters";
import QuickBpHomeButton from "@/components/home/QuickBpHomeButton";
import { useDashboardSession } from "@/components/home/use-dashboard-session";
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
import {
  fetchTodayHydrationTotalsFromDailyLogs,
  persistDailyLogToSupabase,
  applyTodaysDailyLogsFullCycleToQueryClient,
} from "@/lib/supabase/daily-logs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { resolveSupabaseUserId } from "@/lib/supabase/auth-save-guard";
import {
  atmosphericPressureFooter,
  fetchAndLogWeather,
} from "@/lib/weather";
import type { SavedMedication } from "@/lib/seed-medications";
import {
  isWelcomeWizardComplete,
  loadBaselines,
  type BaselinesProfile,
} from "@/lib/baselines-storage";
import { cn } from "@/lib/utils";

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

type HomeDashboardAccordionProps = {
  panelId: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/**
 * Mobile-first expand/collapse — `open` is ordinary React state (no Supabase,
 * no localStorage). Content mounts only when open so nested trackers do not
 * fetch until the user expands.
 */
function HomeDashboardAccordion({
  panelId,
  title,
  open,
  onToggle,
  children,
}: HomeDashboardAccordionProps) {
  const triggerId = `${panelId}-trigger`;
  return (
    <div className="overflow-hidden rounded-2xl border-4 border-black bg-white shadow-sm">
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex w-full min-h-[56px] items-center justify-between gap-3 px-4 py-4 text-left touch-manipulation sm:min-h-[60px] sm:px-5",
          "text-lg font-black tracking-tight text-slate-900 sm:text-xl",
          "transition-colors active:bg-slate-100",
        )}
      >
        <span className="min-w-0">{title}</span>
        <span className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="text-sm font-bold uppercase tracking-wide text-slate-600 sm:text-base">
            {open ? "Hide" : "Show"}
          </span>
          <span
            className="flex h-12 min-h-12 min-w-12 w-12 items-center justify-center rounded-xl border-2 border-slate-900 bg-slate-50 sm:h-14 sm:min-h-14 sm:min-w-14 sm:w-14"
            aria-hidden
          >
            <ChevronDown
              className={cn(
                "h-7 w-7 shrink-0 text-slate-900 transition-transform sm:h-8 sm:w-8",
                open && "rotate-180",
              )}
            />
          </span>
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="border-t-4 border-slate-200 px-3 pb-5 pt-4 sm:px-4"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type MinimalHomeDashboardProps = {
  /** TEMP: skip barometer advisory card if it interferes with taps */
  bypassBarometerAdvisory?: boolean;
};

export default function MinimalHomeDashboard({
  bypassBarometerAdvisory = false,
}: MinimalHomeDashboardProps) {
  const qc = useQueryClient();
  const { showAuthGate, countersEnabled, sessionUserId } = useDashboardSession();
  const [homeTotalsRefreshKey, setHomeTotalsRefreshKey] = useState(0);
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
  const [welcomeOpen, setWelcomeOpen] = useState<boolean | null>(null);
  const [todaysLogsSyncing, setTodaysLogsSyncing] = useState(false);
  const [morningRoutineAccordionOpen, setMorningRoutineAccordionOpen] =
    useState(false);
  const [symptomsAccordionOpen, setSymptomsAccordionOpen] = useState(false);
  const morningRoutinePanelId = useId();
  const symptomsPanelId = useId();

  /**
   * Full-cycle sync: re-read today’s hydration sums from Supabase (same `recorded_at`
   * window as inserts), push them into React Query, and invalidate `daily_logs` so
   * lists stay aligned.
   */
  const fetchTodaysLogs = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return null;
    setTodaysLogsSyncing(true);
    try {
      const uid = await resolveSupabaseUserId(sb);
      if (!uid) return null;
      try {
        return await applyTodaysDailyLogsFullCycleToQueryClient(qc);
      } catch (e) {
        console.error("[home] fetchTodaysLogs (water/salt sync only):", e);
        return null;
      }
    } finally {
      setTodaysLogsSyncing(false);
    }
  }, [qc]);

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
    const onBaselines = () => {
      setBaselines(loadBaselines());
    };
    window.addEventListener("tiaki-baselines-updated", onBaselines);
    return () =>
      window.removeEventListener("tiaki-baselines-updated", onBaselines);
  }, []);

  useEffect(() => {
    setWelcomeOpen(!isWelcomeWizardComplete());
  }, []);

  useEffect(() => {
    if (!countersEnabled) return;
    void qc.invalidateQueries({ queryKey: qk.dailyLogs, exact: true });
    void qc.invalidateQueries({ queryKey: qk.hydrationTotalsTodayRoot });
    void qc.invalidateQueries({ queryKey: qk.dailyLogDogWalkCountToday });
    void qc.invalidateQueries({ queryKey: qk.activityToday });
    setHomeTotalsRefreshKey((k) => k + 1);
  }, [countersEnabled, qc]);

  const hydrationTotalsQuery = useQuery({
    queryKey: [
      ...qk.hydrationTotalsTodayRoot,
      sessionUserId ?? "none",
      homeTotalsRefreshKey,
    ],
    queryFn: fetchTodayHydrationTotalsFromDailyLogs,
    enabled: Boolean(countersEnabled && sessionUserId),
    staleTime: 30_000,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: true,
  });

  // Today's totals are summed from `daily_logs.value`, grouped by the `entry_type`
  // column (`water`, `caffeine`, `sodium`, `food`) — not `log_entry_type`. Inserts
  // (episode marker + anything from HydrationTracker) go through
  // `persistDailyLogToSupabase`, which writes `entry_type` only. The `unit` column is
  // intentionally ignored for the math — it's only the visible suffix ("oz" / "mg").
  // Source of truth: `fetchTodayHydrationTotalsFromDailyLogs` in `lib/supabase/daily-logs`.
  const todayWaterOz = hydrationTotalsQuery.data?.oz ?? 0;
  const todayCaffeineMg = hydrationTotalsQuery.data?.caffeineMg ?? 0;
  const todaySodiumMg = hydrationTotalsQuery.data?.sodiumMg ?? 0;
  const todayCaloriesKcal = hydrationTotalsQuery.data?.caloriesKcal ?? 0;

  // Hard-cap the "…" placeholder at 2s — if Supabase hangs, we'd rather show
  // zeros and let optimistic taps populate the strip than freeze on a spinner.
  const [totalsLoadTimedOut, setTotalsLoadTimedOut] = useState(false);
  const isAwaitingFirstTotals =
    Boolean(countersEnabled && sessionUserId) &&
    !hydrationTotalsQuery.isError &&
    hydrationTotalsQuery.data == null;
  useEffect(() => {
    if (!isAwaitingFirstTotals) {
      setTotalsLoadTimedOut(false);
      return;
    }
    const t = window.setTimeout(() => setTotalsLoadTimedOut(true), 400);
    return () => window.clearTimeout(t);
  }, [isAwaitingFirstTotals]);
  const todayTotalsLoading = isAwaitingFirstTotals && !totalsLoadTimedOut;

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
      let snap: Awaited<ReturnType<typeof fetchAndLogWeather>> = null;
      try {
        snap = await fetchAndLogWeather();
      } catch (e) {
        console.warn("[home] episode: weather fetch skipped (isolated):", e);
        snap = null;
      }

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
        // `persistDailyLogToSupabase` → `daily_logs.entry_type` only (never `log_entry_type`).
        const result = await persistDailyLogToSupabase(marker);
        if (!result.ok)
          throw new Error(result.error ?? "Could not save episode.");
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
      void qc.invalidateQueries({ queryKey: qk.dailyLogs, exact: true });
      setEpisodeSketchOpen(true);
    },
    onError: (e) => {
      console.error("[home] episode log failed:", e);
    },
  });

  if (showAuthGate) {
    return (
      <div className="flex min-h-[75vh] flex-col items-center justify-center gap-6 px-4 pb-16 pt-8">
        <div className="max-w-md space-y-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">
            Tiaki
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Sign in to continue
          </h1>
          <p className="text-base font-medium leading-relaxed text-slate-600">
            Your water totals, medications, movement logs, and symptom matrix sync
            to your account after you sign in.
          </p>
          <Link
            href="/auth?next=/"
            className="inline-flex min-h-[56px] min-w-[12rem] items-center justify-center rounded-2xl border-4 border-black bg-black px-8 text-lg font-black text-white shadow-md transition hover:bg-neutral-900"
          >
            Sign in
          </Link>
          <p className="text-sm font-medium text-slate-600">
            New here?{" "}
            <Link
              href="/auth?next=/"
              className="font-bold text-sky-700 underline underline-offset-2"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {welcomeOpen === true && (
        <WelcomeWizard onComplete={() => setWelcomeOpen(false)} />
      )}

      <header
        id="planner-home-sticky-header"
        className="sticky top-0 z-[90] -mx-4 mb-2 flex flex-row items-start justify-between gap-3 border-b-2 border-slate-900 bg-white/95 px-4 py-3 pb-4 shadow-[0_4px_12px_rgba(15,23,42,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 sm:-mx-5 sm:px-5"
      >
        <div className="min-w-0 flex-1 space-y-1 pr-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {displayFirstName
              ? `${greeting()}, ${displayFirstName}`
              : greeting()}
          </h1>
          <p className="text-base font-medium text-slate-700 sm:text-lg">
            {formatLongDate()}
          </p>
        </div>
        <QuickBpHomeButton
          onAfterSuccessfulSave={() => {
            try {
              void fetchTodaysLogs();
            } catch (e) {
              console.warn("[home] post-BP hydration refresh failed:", e);
            }
          }}
        />
      </header>

      <HomeDashboardTopZone bypassBarometerAdvisory={bypassBarometerAdvisory} />

      <HomeDailyActionGrid />

      <div className="rounded-2xl border-2 border-black bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-800 px-4 py-4 shadow-lg">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/90">
          Tiaki
        </p>
        <p className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
          Your daily care companion
        </p>
        <p className="mt-1 max-w-xl text-sm font-semibold leading-snug text-white/95">
          Medications, routines, vitals, and quick logs in one calm,
          high-contrast screen.
        </p>
      </div>

      <DashboardTodayCounters enabled={countersEnabled} />

      <QuickRelief />

      <HomeDashboardAccordion
        panelId={morningRoutinePanelId}
        title="Morning routine"
        open={morningRoutineAccordionOpen}
        onToggle={() => setMorningRoutineAccordionOpen((v) => !v)}
      >
        <MorningRoutine />
      </HomeDashboardAccordion>

      <HomeDashboardAccordion
        panelId={symptomsPanelId}
        title="Symptoms tracker"
        open={symptomsAccordionOpen}
        onToggle={() => setSymptomsAccordionOpen((v) => !v)}
      >
        <SymptomMatrix />
      </HomeDashboardAccordion>

      <section aria-labelledby="daily-pulse-heading" className="space-y-4">
        <h2
          id="daily-pulse-heading"
          className="text-xs font-bold uppercase tracking-[0.25em] text-slate-900"
        >
          Daily pulse
        </h2>
        <PulseStrip />
        {countersEnabled && sessionUserId && (
          <dl
            aria-label="Today's logged totals"
            aria-live="polite"
            aria-busy={todayTotalsLoading}
            className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-slate-300 bg-white px-3 py-3 text-center shadow-sm sm:grid-cols-4"
          >
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                Water
              </dt>
              <dd className="mt-1 font-mono text-lg font-black tabular-nums text-sky-900">
                <>
                  {todayWaterOz}
                  <span className="ml-1 text-xs font-bold text-sky-800/80">
                    oz
                  </span>
                </>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                Caffeine
              </dt>
              <dd className="mt-1 font-mono text-lg font-black tabular-nums text-amber-950">
                <>
                  {todayCaffeineMg}
                  <span className="ml-1 text-xs font-bold text-amber-900/80">
                    mg
                  </span>
                </>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                Sodium
              </dt>
              <dd className="mt-1 font-mono text-lg font-black tabular-nums text-amber-950">
                <>
                  {todaySodiumMg}
                  <span className="ml-1 text-xs font-bold text-amber-900/80">
                    mg
                  </span>
                </>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                Calories
              </dt>
              <dd className="mt-1 font-mono text-lg font-black tabular-nums text-emerald-950">
                <>
                  {todayCaloriesKcal}
                  <span className="ml-1 text-xs font-bold text-emerald-900/80">
                    kcal
                  </span>
                </>
              </dd>
            </div>
          </dl>
        )}
        <div id="home-hydration" className="scroll-mt-28 space-y-4">
          <HydrationTracker
            compact
            waterGoalOz={baselines.targetWaterOz}
            homeTotalsRefreshKey={homeTotalsRefreshKey}
            onFullCycleSync={fetchTodaysLogs}
            fullCycleSyncing={todaysLogsSyncing}
          />
          <SaltTracker compact />
        </div>
        <Link
          href="/vault#side-effect-tracker"
          className="flex min-h-[56px] w-full items-center justify-center rounded-2xl border-4 border-violet-800 bg-violet-600 px-5 py-4 text-lg font-black uppercase tracking-wide text-white shadow-md transition hover:bg-violet-700"
        >
          Track Side Effects
        </Link>
      </section>

      <ShowerTracker />

          <MovementTracker onFullCycleSync={fetchTodaysLogs} />

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
