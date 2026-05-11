"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Activity, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { FeatureHelpTrigger } from "@/components/FeatureHelpModal";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import {
  groupSideEffectLogsForTolerability,
  symptomIncludesDizziness,
} from "@/lib/drug-tolerability-stats";
import type { SideEffectLog } from "@/lib/types";
import { persistSideEffectLogToSupabase } from "@/lib/supabase/wellness-side-effects";
import { getActiveMedications } from "@/lib/medication-active";
import { TOAST_SIDE_EFFECT } from "@/lib/educational-toasts";

const COMMON_EFFECTS = [
  "Nausea",
  "Dizziness",
  "Brain Fog",
  "Skin Flush",
] as const;

function formatPct(p: number | null): string {
  if (p === null) return "—";
  return `${p}%`;
}

export default function SideEffectTracker() {
  const qc = useQueryClient();
  const { data: medications = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: fetchMedicationsQuery,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const activeMeds = useMemo(
    () => getActiveMedications(medications),
    [medications],
  );

  const { data: sideEffectLogs = [] } = useQuery({
    queryKey: qk.sideEffectLogs,
    queryFn: async (): Promise<SideEffectLog[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const grouped = useMemo(
    () => groupSideEffectLogsForTolerability(sideEffectLogs),
    [sideEffectLogs],
  );

  const dizzinessLogs = useMemo(
    () => sideEffectLogs.filter((l) => symptomIncludesDizziness(l.symptoms)),
    [sideEffectLogs],
  );

  const [medicationId, setMedicationId] = useState("");
  const [doseLabel, setDoseLabel] = useState("");
  const [severity, setSeverity] = useState(5);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const addLog = useMutation({
    mutationFn: async (row: SideEffectLog) => {
      await persistSideEffectLogToSupabase(row);
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<SideEffectLog[]>(qk.sideEffectLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      setDoseLabel("");
      setPicked(new Set());
      setSeverity(5);
      setSaveToast(TOAST_SIDE_EFFECT);
      window.setTimeout(() => setSaveToast(null), 4500);
    },
  });

  function toggleSymptom(s: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function submitLog(e: React.FormEvent) {
    e.preventDefault();
    const med = medications.find((m) => m.id === medicationId);
    if (!med || picked.size === 0) return;
    addLog.mutate({
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      medicationId: med.id,
      medicationName: med.name,
      doseLabel: doseLabel.trim() || undefined,
      symptoms: Array.from(picked),
      severity,
    });
  }

  /** Two-tap flow: medication selected + one effect chip submits with current severity. */
  function quickLogSingleEffect(effect: string) {
    const med = medications.find((m) => m.id === medicationId);
    if (!med) return;
    addLog.mutate({
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      medicationId: med.id,
      medicationName: med.name,
      doseLabel: doseLabel.trim() || undefined,
      symptoms: [effect],
      severity,
    });
  }

  return (
    <section
      id="side-effect-tracker"
      className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60"
    >
      <div className="flex flex-wrap items-start gap-3">
        <FileText
          className="mt-0.5 h-6 w-6 shrink-0 text-violet-400"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-slate-900">
              Side Effect Tracker
            </h2>
            <FeatureHelpTrigger
              ariaLabel="Side effect tracker help"
              title="Side Effect Tracker"
            >
              <p>
                <strong>Why track effects:</strong> Dysautonomia meds are often
                titrated slowly. Logging timing, dose label, and symptoms after
                doses helps your team separate drug effects from positional or
                mast-cell-type flares.
              </p>
              <p>
                <strong>How to log:</strong> Pick the medication, set severity,
                then tap common symptoms or use Quick for one-tap with the
                current slider. Log as soon as you can while your memory is
                fresh.
              </p>
              <p>
                <strong>Patterns:</strong> Tiaki groups by medication and flags
                dizziness overlap — useful when OH symptoms mimic medication
                side effects.
              </p>
            </FeatureHelpTrigger>
          </div>
          <p className="mt-3 text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
            How are you feeling after your meds?
          </p>
          <p className="mt-3 max-w-prose text-base font-medium text-slate-600">
            Log reactions after doses for your care team. Summary groups entries by
            medication; dizziness rate helps spot orthostatic overlap.
          </p>
        </div>
      </div>

      {activeMeds.length === 0 ? (
        <div className="mt-8 rounded-2xl border-4 border-amber-600 bg-amber-50 p-6">
          <p className="text-lg font-bold text-amber-950">
            Add medications in Tiaki first — side-effect buttons are built from
            your vault list only.
          </p>
          <Link
            href="/meds"
            className="mt-4 inline-flex min-h-[52px] items-center gap-2 rounded-xl border-4 border-black bg-sky-600 px-6 text-lg font-black uppercase tracking-wide text-white"
          >
            <Activity className="h-6 w-6" aria-hidden />
            Open medication setup
          </Link>
        </div>
      ) : null}

      {sideEffectLogs.length === 0 ? (
        <p className="mt-6 text-base font-medium text-slate-600">
          No entries yet. Pick a medication and symptoms below — data saves for
          reports when signed in.
        </p>
      ) : (
        <>
          <p className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">
            Summary · Dizziness after dose
          </p>
          <p className="mt-1 text-base text-slate-600">
            {dizzinessLogs.length} of {sideEffectLogs.length} logged events (
            {formatPct(
              sideEffectLogs.length === 0
                ? null
                : Math.round(
                    (dizzinessLogs.length / sideEffectLogs.length) * 1000,
                  ) / 10,
            )}{" "}
            overall)
          </p>

          <ul className="mt-4 space-y-6">
            {grouped.map((g) => (
              <li
                key={g.medicationId}
                className="rounded-xl border border-slate-300 bg-slate-100/80 px-4 py-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    {g.medicationName}
                  </h3>
                  <span className="font-mono text-sm tabular-nums text-sky-700">
                    {formatPct(g.dizzinessPct)} dizzy
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {g.dizzinessCount} / {g.totalLogs} logs · Dizziness rate for
                  this medication
                </p>

                {g.byDose.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[280px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
                          <th className="pb-2 pr-3 font-medium">Dose</th>
                          <th className="pb-2 pr-3 font-medium">Logs</th>
                          <th className="pb-2 font-medium">Dizziness</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.byDose.map((d) => (
                          <tr
                            key={d.doseLabel}
                            className="border-b border-slate-200 last:border-0"
                          >
                            <td className="py-2 pr-3 text-slate-800">
                              {d.doseLabel}
                            </td>
                            <td className="py-2 pr-3 font-mono tabular-nums text-slate-600">
                              {d.totalLogs}
                            </td>
                            <td className="py-2 font-mono tabular-nums text-sky-700">
                              {formatPct(d.dizzinessPct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <form
        onSubmit={submitLog}
        className="mt-10 space-y-6 rounded-xl border-4 border-slate-200 bg-slate-50/95 p-5"
      >
        <p className="text-xl font-black text-slate-900">Log an effect</p>

        <div>
          <p className="text-lg font-bold text-slate-900">Medication</p>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Tap your med, set severity, then choose common effects (or use Save).
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {activeMeds.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMedicationId(m.id)}
                className={`min-h-[56px] min-w-[8rem] rounded-2xl border-4 px-4 text-lg font-black transition ${
                  medicationId === m.id
                    ? "border-violet-700 bg-violet-700 text-white"
                    : "border-slate-400 bg-white text-slate-900 hover:bg-slate-100"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="sev-slider"
            className="flex flex-wrap items-baseline justify-between gap-2 text-lg font-bold text-slate-900"
          >
            Severity
            <span className="font-mono text-2xl tabular-nums text-violet-800">
              {severity} / 10
            </span>
          </label>
          <input
            id="sev-slider"
            type="range"
            min={1}
            max={10}
            step={1}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className="mt-3 h-4 w-full cursor-pointer accent-violet-700"
          />
          <p className="mt-1 text-sm text-slate-600">
            1 = barely noticeable · 10 = severe
          </p>
        </div>

        <div>
          <label
            htmlFor="se-dose"
            className="text-base font-bold text-slate-900"
          >
            Dose label <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="se-dose"
            className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-lg text-slate-900"
            value={doseLabel}
            onChange={(e) => setDoseLabel(e.target.value)}
            placeholder="e.g. 40 mg evening"
            autoComplete="off"
          />
        </div>

        <div>
          <p className="text-lg font-black text-slate-900">Common effects</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {COMMON_EFFECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  toggleSymptom(s);
                }}
                className={`min-h-[64px] rounded-2xl border-4 px-4 text-left text-lg font-black transition ${
                  picked.has(s)
                    ? "border-violet-600 bg-violet-600 text-white"
                    : "border-slate-400 bg-white text-slate-900 hover:bg-slate-100"
                }`}
              >
                {picked.has(s) ? "✓ " : ""}
                {s}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600">
            Use{" "}
            <span className="font-bold text-slate-800">Quick</span> for one-tap
            logging with the severity slider above, or select multiple and{" "}
            <span className="font-bold text-slate-800">Save log</span>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {COMMON_EFFECTS.map((s) => (
              <button
                key={`q-${s}`}
                type="button"
                disabled={!medicationId || addLog.isPending}
                onClick={() => quickLogSingleEffect(s)}
                className="rounded-full border-2 border-violet-400 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-950 disabled:opacity-40"
              >
                Quick: {s}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full min-h-[56px] rounded-2xl bg-violet-700 py-4 text-xl font-black uppercase tracking-wide text-white hover:bg-violet-600 disabled:opacity-50"
          disabled={
            !medicationId || picked.size === 0 || addLog.isPending
          }
        >
          {addLog.isPending ? "Saving…" : "Save log"}
        </button>
      </form>

      {saveToast && (
        <p
          className="mt-6 rounded-xl border-4 border-emerald-800 bg-emerald-50 px-4 py-4 text-center text-[18px] font-semibold leading-snug text-emerald-950"
          role="status"
        >
          {saveToast}
        </p>
      )}
    </section>
  );
}
