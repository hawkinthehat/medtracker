"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Dog, Loader2, Settings2 } from "lucide-react";
import { qk } from "@/lib/query-keys";
import type { DailyLogEntry } from "@/lib/types";
import { persistDailyLogToSupabase } from "@/lib/supabase/daily-logs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { insertActivityLogRow } from "@/lib/supabase/activity-logs";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";
import { fetchAndLogWeather } from "@/lib/weather";
import { getEnvironmentSnapshot } from "@/lib/environment-snapshot";
import {
  getWalkButtonLabel,
  getWalkNotesDefault,
  setWalkButtonLabel,
  setWalkNotesDefault,
  DEFAULT_WALK_BUTTON_LABEL,
  DEFAULT_WALK_NOTES,
} from "@/lib/movement-settings";
import {
  appendAmbientContext,
  calendarDayLocal,
  countDogWalksToday,
  DOG_WALK_MARKER,
  getMorningHeartRateBpmToday,
  ptMarker,
  type PtSlot,
} from "@/lib/movement-tracking";
import { FeatureHelpTrigger } from "@/components/FeatureHelpModal";
const PT_SLOTS: { slot: PtSlot; label: string }[] = [
  { slot: "morning", label: "Morning PT" },
  { slot: "noon", label: "Noon PT" },
  { slot: "night", label: "Night PT" },
];

function ptStorageKey(day: string) {
  return `tiaki-pt-latched-${day}`;
}

function loadPtLatched(day: string): Record<PtSlot, boolean> {
  try {
    const raw = window.localStorage.getItem(ptStorageKey(day));
    if (!raw) return { morning: false, noon: false, night: false };
    const p = JSON.parse(raw) as Partial<Record<PtSlot, boolean>>;
    return {
      morning: Boolean(p.morning),
      noon: Boolean(p.noon),
      night: Boolean(p.night),
    };
  } catch {
    return { morning: false, noon: false, night: false };
  }
}

function savePtLatched(day: string, state: Record<PtSlot, boolean>) {
  try {
    window.localStorage.setItem(ptStorageKey(day), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export default function MovementTracker() {
  const router = useRouter();
  const qc = useQueryClient();
  const today = calendarDayLocal();

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
    queryFn: async () => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const [walkLabelDraft, setWalkLabelDraft] = useState(DEFAULT_WALK_BUTTON_LABEL);
  const [walkNotesDraft, setWalkNotesDraft] = useState(DEFAULT_WALK_NOTES);
  const [walkButtonDisplay, setWalkButtonDisplay] =
    useState(DEFAULT_WALK_BUTTON_LABEL);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [ptLatched, setPtLatched] = useState<Record<PtSlot, boolean>>({
    morning: false,
    noon: false,
    night: false,
  });

  const [showHrNudge, setShowHrNudge] = useState(false);

  useEffect(() => {
    setWalkLabelDraft(getWalkButtonLabel());
    setWalkNotesDraft(getWalkNotesDefault());
    setWalkButtonDisplay(getWalkButtonLabel());
  }, []);

  useEffect(() => {
    setPtLatched(loadPtLatched(today));
  }, [today]);

  const walksToday = useMemo(
    () => countDogWalksToday(dailyLogs, today),
    [dailyLogs, today],
  );

  const morningHr = useMemo(
    () => getMorningHeartRateBpmToday(vitals, dailyLogs, today),
    [vitals, dailyLogs, today],
  );

  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

  const logMovementEntry = useMutation({
    mutationFn: async (entry: DailyLogEntry) => {
      if (supabaseConfigured) {
        const result = await persistDailyLogToSupabase(entry);
        if (!result.ok) {
          throw new Error(result.error ?? "Could not sync movement entry.");
        }
      }
      return entry;
    },
    onSuccess: (entry) => {
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        entry,
        ...prev,
      ]);
      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
    },
  });

  const appendWeatherNotes = useCallback(
    async (baseNotes: string, opts?: { skipWeatherFetch?: boolean }) => {
      if (!opts?.skipWeatherFetch) {
        await fetchAndLogWeather().catch(() => {});
      }
      const snap = getEnvironmentSnapshot();
      const full = appendAmbientContext(baseNotes, snap);
      return full;
    },
    [],
  );

  const [pendingWalk, setPendingWalk] = useState(false);
  const [pendingPtSlot, setPendingPtSlot] = useState<PtSlot | null>(null);
  /** Instant walk count before React Query catches up */
  const [optimisticWalkBump, setOptimisticWalkBump] = useState(0);

  const walksTodayDisplay = useMemo(
    () => walksToday + optimisticWalkBump,
    [walksToday, optimisticWalkBump],
  );

  async function handleDogWalk(skipNudge = false) {
    const walksBefore = countDogWalksToday(
      qc.getQueryData<DailyLogEntry[]>(qk.dailyLogs) ?? dailyLogs,
      today,
    );

    if (
      !skipNudge &&
      walksBefore === 1 &&
      morningHr != null &&
      morningHr > 100
    ) {
      setShowHrNudge(true);
      return;
    }

    setShowHrNudge(false);

    setOptimisticWalkBump((b) => b + 1);
    setPendingWalk(true);
    try {
      await fetchAndLogWeather().catch(() => {});

      const recordedAt = new Date().toISOString();
      const label = getWalkButtonLabel();
      const base =
        `${getWalkNotesDefault().trim()}\n${DOG_WALK_MARKER}`.trim();
      const notes = await appendWeatherNotes(base, { skipWeatherFetch: true });

      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt,
        category: "activity",
        label,
        notes,
      };

      await logMovementEntry.mutateAsync(row);

      const act = await insertActivityLogRow({
        activity_type: "dog_walk",
        notes: getWalkNotesDefault().trim() || DEFAULT_WALK_NOTES,
        recorded_at: recordedAt,
      });
      if (!act.ok) {
        throw new Error(act.error ?? "Could not save activity log.");
      }

      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
      void qc.invalidateQueries({ queryKey: qk.activityToday });
      router.refresh();
      window.location.reload();
    } catch (e) {
      setOptimisticWalkBump((b) => Math.max(0, b - 1));
      console.error("[handleDogWalk] Failed to save movement / daily_logs:", e);
      throw e;
    } finally {
      setPendingWalk(false);
    }
  }

  async function handlePt(slot: PtSlot, humanLabel: string) {
    if (ptLatched[slot]) return;

    const rollback = { ...ptLatched };
    setPtLatched((p) => {
      const next = { ...p, [slot]: true };
      savePtLatched(today, next);
      return next;
    });

    setPendingPtSlot(slot);
    try {
      const base = `${humanLabel} session${ptMarker(slot)}`;
      const notes = await appendWeatherNotes(base);

      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        category: "activity",
        label: humanLabel,
        notes,
      };

      await logMovementEntry.mutateAsync(row);

      const act = await insertActivityLogRow({
        activity_type: "pt",
        notes: `${humanLabel} · ${slot}`,
        recorded_at: row.recordedAt,
      });
      if (!act.ok) {
        throw new Error(act.error ?? "Could not save activity log.");
      }

      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
      void qc.invalidateQueries({ queryKey: qk.activityToday });
      router.refresh();
      window.location.reload();
    } catch (e) {
      setPtLatched(rollback);
      savePtLatched(today, rollback);
      console.error("[handlePt] Failed to save PT / activity_logs:", e);
      throw e;
    } finally {
      setPendingPtSlot(null);
    }
  }

  function saveMovementSettings() {
    setWalkButtonLabel(walkLabelDraft);
    setWalkNotesDefault(walkNotesDraft);
    setWalkButtonDisplay(walkLabelDraft.trim() || DEFAULT_WALK_BUTTON_LABEL);
    setSettingsOpen(false);
  }

  const movementBusy =
    pendingWalk || pendingPtSlot !== null || logMovementEntry.isPending;

  return (
    <section
      id="home-movement"
      aria-labelledby="movement-tracker-heading"
      className="scroll-mt-28 rounded-2xl border-4 border-black bg-white p-5 shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h2
            id="movement-tracker-heading"
            className="text-xl font-black tracking-tight text-slate-900"
          >
            Movement
          </h2>
          <FeatureHelpTrigger ariaLabel="Movement help" title="Movement">
            <p>
              One-tap logging for walks and PT — weather context is saved with
              each entry so you and your care team can spot patterns.
            </p>
          </FeatureHelpTrigger>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border-4 border-black bg-white px-4 text-lg font-bold text-slate-900"
          aria-expanded={settingsOpen}
        >
          <Settings2 className="h-7 w-7 shrink-0" aria-hidden />
          Labels
        </button>
      </div>

      {settingsOpen && (
        <div className="mt-4 space-y-4 rounded-xl border-4 border-slate-400 bg-slate-50 p-4">
          <p className="text-lg font-semibold text-slate-800">
            Customize activity label (saved on this device only).
          </p>
          <label className="block text-lg font-bold text-slate-900">
            Button label
            <input
              value={walkLabelDraft}
              onChange={(e) => setWalkLabelDraft(e.target.value)}
              className="mt-2 min-h-[52px] w-full rounded-xl border-4 border-black bg-white px-4 text-lg font-semibold text-slate-900"
            />
          </label>
          <label className="block text-lg font-bold text-slate-900">
            Default note (saved to Supabase history)
            <textarea
              value={walkNotesDraft}
              onChange={(e) => setWalkNotesDraft(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border-4 border-black bg-white px-4 py-3 text-lg font-semibold text-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={saveMovementSettings}
            className="min-h-[52px] rounded-xl border-4 border-black bg-sky-600 px-6 text-lg font-black uppercase tracking-wide text-white"
          >
            Save movement labels
          </button>
        </div>
      )}

      <div id="home-movement-walk">
      <button
        type="button"
        disabled={movementBusy}
        onClick={() => void handleDogWalk()}
        className="mt-5 flex min-h-[80px] w-full items-center justify-center gap-4 rounded-2xl border-4 border-black bg-white px-5 py-6 text-2xl font-black leading-snug text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
      >
        {pendingWalk ? (
          <>
            <Loader2
              className="h-12 w-12 shrink-0 animate-spin text-sky-700"
              strokeWidth={2.5}
              aria-hidden
            />
            <span className="text-center leading-tight">Logging…</span>
          </>
        ) : (
          <>
            <Dog className="h-12 w-12 shrink-0 text-slate-900" strokeWidth={2.5} aria-hidden />
            <span className="text-center leading-tight">
              {walkButtonDisplay}
            </span>
          </>
        )}
      </button>
      </div>

      <p className="mt-4 text-center text-xl font-black text-slate-900">
        Daily walks today:{" "}
        <span className="tabular-nums">{walksTodayDisplay}</span>
      </p>

      {showHrNudge && (
        <div
          role="status"
          className="mt-5 rounded-2xl border-4 border-amber-600 bg-amber-100 p-5 text-center text-xl font-black leading-snug text-slate-950"
        >
          Tiaki Note: Your heart rate was a bit high this morning. Make sure to
          take it slow on this walk!
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowHrNudge(false)}
              className="min-h-[52px] rounded-xl border-4 border-black bg-white px-6 text-lg font-bold text-slate-900"
            >
              Go back
            </button>
            <button
              type="button"
              disabled={movementBusy}
              onClick={() => void handleDogWalk(true)}
              className="min-h-[52px] rounded-xl border-4 border-black bg-sky-600 px-6 text-lg font-black uppercase tracking-wide text-white"
            >
              Log walk anyway
            </button>
          </div>
        </div>
      )}

      <div id="home-pt" className="scroll-mt-28 mt-8 space-y-4">
        <p className="text-xl font-black text-slate-900">PT sessions</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          {PT_SLOTS.map(({ slot, label }) => (
            <button
              key={slot}
              type="button"
              disabled={ptLatched[slot] || movementBusy}
              onClick={() => void handlePt(slot, label)}
              className={`min-h-[68px] flex-1 rounded-2xl border-4 px-5 py-4 text-xl font-black transition sm:min-w-[11rem] ${
                ptLatched[slot]
                  ? "border-black bg-amber-300 text-slate-950 ring-4 ring-amber-500/70"
                  : "border-black bg-white text-slate-900 hover:bg-slate-50"
              } disabled:cursor-default`}
              aria-pressed={ptLatched[slot]}
            >
              {pendingPtSlot === slot ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2
                    className="h-7 w-7 shrink-0 animate-spin text-sky-800"
                    aria-hidden
                  />
                  Logging…
                </span>
              ) : (
                <>
                  {label}
                  {ptLatched[slot] ? " ✓" : ""}
                </>
              )}
            </button>
          ))}
        </div>
        <p className="text-base font-medium text-slate-700">
          Tap once when done — stays highlighted for the day. Weather details
          are saved with each session. When signed in, entries also go to{" "}
          <span className="font-semibold text-slate-900">activity_logs</span>{" "}
          (movement/PT) alongside your{" "}
          <span className="font-semibold text-slate-900">daily_logs</span> feed.
        </p>
      </div>

      {morningHr != null && (
        <p className="mt-4 text-base font-semibold text-slate-600">
          Morning HR logged today: {morningHr} BPM
        </p>
      )}

      {logMovementEntry.isError && (
        <p className="mt-3 text-lg font-bold text-red-700" role="alert">
          {logMovementEntry.error instanceof Error
            ? logMovementEntry.error.message
            : "Could not save entry."}
        </p>
      )}
    </section>
  );
}
