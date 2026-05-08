"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { qk } from "@/lib/query-keys";
import {
  SEED_SAVED_MEDICATIONS,
  type SavedMedication,
} from "@/lib/seed-medications";
import {
  groupSideEffectLogsForTolerability,
  symptomIncludesDizziness,
} from "@/lib/drug-tolerability-stats";
import type { SideEffectLog } from "@/lib/types";
import { persistSideEffectLogToSupabase } from "@/lib/supabase/wellness-side-effects";

const COVER_LETTER =
  "Jade's profile shows a hypersensitivity to CYP3A4 substrates when inhibitors are present.";

const SYMPTOM_OPTIONS = [
  "Dizziness",
  "Nausea",
  "Flushing",
  "Brain Fog",
  "Headache",
] as const;

function formatPct(p: number | null): string {
  if (p === null) return "—";
  return `${p}%`;
}

export default function DrugTolerabilityReport() {
  const qc = useQueryClient();
  const { data: medications = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: async (): Promise<SavedMedication[]> => SEED_SAVED_MEDICATIONS,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: sideEffectLogs = [] } = useQuery({
    queryKey: qk.sideEffectLogs,
    queryFn: async (): Promise<SideEffectLog[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const grouped = useMemo(
    () => groupSideEffectLogsForTolerability(sideEffectLogs),
    [sideEffectLogs]
  );

  const dizzinessLogs = useMemo(
    () => sideEffectLogs.filter((l) => symptomIncludesDizziness(l.symptoms)),
    [sideEffectLogs]
  );

  const [medicationId, setMedicationId] = useState("");
  const [doseLabel, setDoseLabel] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

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
    });
  }

  return (
    <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
      <div className="flex flex-wrap items-start gap-3">
        <FileText
          className="mt-0.5 h-6 w-6 shrink-0 text-violet-400"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">
            Drug Tolerability Report
          </h2>
          <p className="mt-1 max-w-prose text-sm text-slate-400">
            Cover letter for Missouri specialists. Side-effect logs are grouped
            by medication and dose; rates show how often{" "}
            <span className="text-slate-800">Dizziness</span> was logged after a
            dose.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-violet-500/25 bg-violet-950/25 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-300/90">
          Cover letter
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-900">
          {COVER_LETTER}
        </p>
      </div>

      {sideEffectLogs.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No side-effect logs yet. Log a dose below after you take medication —
          data saves locally for this report.
        </p>
      ) : (
        <>
          <p className="mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
            Summary · Dizziness after dose
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {dizzinessLogs.length} of {sideEffectLogs.length} logged dose
            events ({formatPct(
              sideEffectLogs.length === 0
                ? null
                : Math.round(
                    (dizzinessLogs.length / sideEffectLogs.length) * 1000
                  ) / 10
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
                  <h3 className="font-semibold text-slate-900">
                    {g.medicationName}
                  </h3>
                  <span className="font-mono text-sm tabular-nums text-sky-200">
                    {formatPct(g.dizzinessPct)} dizzy
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
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
                            <td className="py-2 pr-3 font-mono tabular-nums text-slate-400">
                              {d.totalLogs}
                            </td>
                            <td className="py-2 font-mono tabular-nums text-sky-200">
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
        className="mt-8 space-y-4 rounded-xl border border-slate-300 bg-slate-50/95 p-4"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Log symptoms after a dose
        </p>
        <div>
          <label
            htmlFor="tol-med"
            className="text-sm font-medium text-slate-800"
          >
            Medication
          </label>
          <select
            id="tol-med"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-base text-slate-900"
            value={medicationId}
            onChange={(e) => setMedicationId(e.target.value)}
            required
          >
            <option value="">Select…</option>
            {medications.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="tol-dose"
            className="text-sm font-medium text-slate-800"
          >
            Dose label{" "}
            <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="tol-dose"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-slate-900"
            value={doseLabel}
            onChange={(e) => setDoseLabel(e.target.value)}
            placeholder="e.g. 40 mg evening"
            autoComplete="off"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800">Symptoms</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SYMPTOM_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSymptom(s)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
                  picked.has(s)
                    ? "border-violet-500/60 bg-violet-950/50 text-violet-100"
                    : "border-slate-300 bg-slate-100/70 text-slate-700 hover:border-slate-500"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-violet-700 py-3 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50"
          disabled={
            !medicationId || picked.size === 0 || addLog.isPending
          }
        >
          {addLog.isPending ? "Saving…" : "Save side-effect log"}
        </button>
      </form>
    </section>
  );
}
