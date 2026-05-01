"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type {
  ClinicalCorrelationSnapshot,
  ClinicalSnapshotsMap,
  DailyLogEntry,
  JournalEntry,
  OrthostaticSession,
  VitalRow,
} from "@/lib/types";
import {
  buildClinicalCorrelationSnapshot,
  todayLocalDateKey,
} from "@/lib/clinical-correlation";
import { generateClinicalCorrelationLockedPdf } from "@/lib/pdf-export";
import { useState } from "react";

export default function ClinicalCorrelationPage() {
  const qc = useQueryClient();
  const todayKey = todayLocalDateKey();
  const [exporting, setExporting] = useState(false);

  const { data: snapMap = {} } = useQuery({
    queryKey: qk.clinicalSnapshots,
    queryFn: async (): Promise<ClinicalSnapshotsMap> => ({}),
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

  const { data: orthostatic = [] } = useQuery({
    queryKey: qk.orthostatic,
    queryFn: async (): Promise<OrthostaticSession[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

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

  const snapshot = snapMap[todayKey];
  const afterNine = new Date().getHours() >= 21;

  const preview = useMutation({
    mutationFn: async () => {
      const prev = qc.getQueryData<ClinicalSnapshotsMap>(qk.clinicalSnapshots) ?? {};
      const existing = prev[todayKey];
      if (existing?.locked) return existing;

      const snap = buildClinicalCorrelationSnapshot({
        dateKey: todayKey,
        vitals,
        orthostatic,
        dailyLogs,
        journal,
        trigger: "manual_preview",
        previous: existing ?? null,
      });
      qc.setQueryData<ClinicalSnapshotsMap>(qk.clinicalSnapshots, (p = {}) => ({
        ...p,
        [todayKey]: snap,
      }));
      return snap;
    },
  });

  async function lockAndExport() {
    setExporting(true);
    try {
      const prev = qc.getQueryData<ClinicalSnapshotsMap>(qk.clinicalSnapshots) ?? {};
      let snap: ClinicalCorrelationSnapshot | undefined = prev[todayKey];

      if (!snap) {
        snap = buildClinicalCorrelationSnapshot({
          dateKey: todayKey,
          vitals,
          orthostatic,
          dailyLogs,
          journal,
          trigger: "manual_preview",
          previous: null,
        });
      }

      if (!snap.locked) {
        const locked: ClinicalCorrelationSnapshot = {
          ...snap,
          locked: true,
          lockedAt: new Date().toISOString(),
        };
        qc.setQueryData<ClinicalSnapshotsMap>(qk.clinicalSnapshots, (p = {}) => ({
          ...p,
          [todayKey]: locked,
        }));
        snap = locked;
      }

      await generateClinicalCorrelationLockedPdf({
        dateKey: todayKey,
        snapshot: snap,
        vitals,
        orthostatic,
        dailyLogs,
        journal,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Clinical correlation
        </h1>
        <p className="text-sm leading-relaxed text-slate-400">
          Each night at <span className="text-slate-200">9:00 PM</span> (your device
          clock), MedTracker summarizes today&apos;s vitals, orthostatic checks,
          daily logs, and journal using simple timing rules. This is a{" "}
          <span className="text-slate-200">hypothesis aid</span>, not a diagnosis.
        </p>
      </header>

      <div
        className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300"
        role="status"
      >
        {afterNine ? (
          <p>
            <span className="font-semibold text-emerald-300/95">Nightly window: </span>
            The 9:00 PM pass runs automatically while the app is open. If you just
            opened the app, wait up to a minute or use Preview below.
          </p>
        ) : (
          <p>
            <span className="font-semibold text-sky-300/95">Before 9:00 PM: </span>
            You can preview correlations now; the scheduled summary will still run
            tonight unless this day is locked.
          </p>
        )}
      </div>

      <section
        className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 ring-1 ring-white/5"
        aria-labelledby="cc-summary-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2
            id="cc-summary-heading"
            className="text-lg font-semibold text-slate-50"
          >
            Today&apos;s summary
          </h2>
          {snapshot?.locked && (
            <span className="rounded-full border border-amber-600/60 bg-amber-950/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
              Locked
            </span>
          )}
        </div>

        {!snapshot && (
          <p className="text-sm text-slate-500">
            No summary yet for {todayKey}. Open the app after 9:00 PM or tap
            Preview.
          </p>
        )}

        {snapshot && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Last computed: {new Date(snapshot.computedAt).toLocaleString()} ·{" "}
              {snapshot.trigger === "scheduled_21_00"
                ? "Nightly engine"
                : "Preview"}
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-slate-200">
              {snapshot.narratives.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            {snapshot.locked && snapshot.lockedAt && (
              <p className="text-xs text-slate-500">
                Locked for export at {new Date(snapshot.lockedAt).toLocaleString()}.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => preview.mutate()}
            disabled={preview.isPending || snapshot?.locked}
            className="flex-1 rounded-xl border border-slate-600 bg-slate-950/80 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-900 disabled:opacity-50"
          >
            {preview.isPending ? "Building preview…" : "Preview correlations now"}
          </button>
          <button
            type="button"
            onClick={lockAndExport}
            disabled={exporting}
            className="flex-1 rounded-xl bg-sky-700 py-3 text-sm font-semibold text-white hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50"
          >
            {exporting
              ? "Preparing PDF…"
              : snapshot?.locked
                ? "Export locked PDF again"
                : "Lock & export for St. Louis team"}
          </button>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-slate-500">
        PDFs are generated locally in your browser. You choose how they are shared.
        A formal HIPAA security program requires organizational safeguards; this
        export uses a clinician-facing layout and confidentiality notices to support
        careful handoff to your St. Louis transition team.
      </p>
    </div>
  );
}
