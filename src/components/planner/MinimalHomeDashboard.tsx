"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardList } from "lucide-react";
import PulseStrip from "@/components/planner/PulseStrip";
import HydrationTracker from "@/components/planner/HydrationTracker";
import DueMedicationsChecklist from "@/components/planner/DueMedicationsChecklist";
import SymptomCanvas from "@/components/journal/SymptomCanvas";
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
  const [episodeSketchOpen, setEpisodeSketchOpen] = useState(false);

  const logCrisisAndOpenSketch = useMutation({
    mutationFn: async () => {
      const recordedAt = new Date().toISOString();
      const marker: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt,
        category: "other",
        label: "Crisis episode marker",
        notes: `Auto-logged when LOG EPISODE pressed (${recordedAt}).`,
      };
      const episode: EpisodeEntry = {
        id: crypto.randomUUID(),
        recordedAt,
        description: "Crisis episode — body sketch session opened",
        painRegions: {},
      };
      const sb = getSupabaseBrowserClient();
      if (sb) {
        const ok = await persistDailyLogToSupabase(marker);
        if (!ok) throw new Error("Could not save crisis marker.");
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
      <header className="space-y-1 border-b-2 border-slate-900 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {greeting()}, Jade
        </h1>
        <p className="text-lg font-medium text-slate-700">{formatLongDate()}</p>
      </header>

      <section aria-labelledby="pulse-heading" className="space-y-4">
        <h2
          id="pulse-heading"
          className="text-xs font-bold uppercase tracking-[0.25em] text-slate-900"
        >
          The pulse
        </h2>
        <PulseStrip />
        <HydrationTracker compact glassCount={8} />
      </section>

      <section aria-labelledby="episode-heading" className="space-y-3">
        <h2 id="episode-heading" className="sr-only">
          Emergency logging
        </h2>
        <button
          type="button"
          onClick={() => logCrisisAndOpenSketch.mutate()}
          disabled={logCrisisAndOpenSketch.isPending}
          className="flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl border-4 border-red-800 bg-red-600 px-6 py-5 text-lg font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-red-700 active:scale-[0.99] disabled:opacity-60"
        >
          <ClipboardList className="h-8 w-8 shrink-0" aria-hidden />
          Log episode
        </button>
        <p className="text-center text-sm text-slate-600">
          Saves a crisis timestamp and opens the body drawing canvas.
        </p>
        {logCrisisAndOpenSketch.isError &&
          logCrisisAndOpenSketch.error instanceof Error && (
            <p className="text-center text-sm font-medium text-red-700" role="alert">
              {logCrisisAndOpenSketch.error.message}
            </p>
          )}
      </section>

      <section aria-labelledby="meds-heading" className="space-y-4">
        <h2
          id="meds-heading"
          className="text-xs font-bold uppercase tracking-[0.25em] text-slate-900"
        >
          Today&apos;s meds
        </h2>
        <DueMedicationsChecklist />
        <Link
          href="/meds"
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-slate-900 bg-white py-3 text-sm font-bold uppercase tracking-wide text-slate-900 shadow-sm transition hover:bg-slate-100"
        >
          Manage meds
        </Link>
      </section>

      <Sheet open={episodeSketchOpen} onOpenChange={setEpisodeSketchOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto border-t-2 border-slate-900 bg-white"
        >
          <SheetHeader className="border-b border-slate-200 pb-4">
            <SheetTitle className="text-slate-900">Body drawing</SheetTitle>
            <SheetDescription className="text-slate-600">
              Trace where symptoms are strongest; save each view to your daily
              log for specialists.
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
