"use client";

import { useMemo } from "react";
import {
  checkOHCumulativeRisk,
  findPathwayInhibitorSubstrateConflicts,
} from "@/lib/metabolic";
import type { SavedMedication } from "@/lib/seed-medications";

type Props = {
  medications: SavedMedication[];
};

export default function MedicationsSafetyPanel({ medications }: Props) {
  const conflicts = useMemo(
    () => findPathwayInhibitorSubstrateConflicts(medications),
    [medications]
  );

  const cumulativeWarning = useMemo(
    () => checkOHCumulativeRisk(medications),
    [medications]
  );

  const hasPathwayIssue = conflicts.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-slate-200/60">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">
          Safety audit
        </h2>

        <div className="mt-4 space-y-3 text-sm">
          <div
            className={`rounded-xl border px-3 py-2.5 ${
              hasPathwayIssue
                ? "border-amber-600/55 bg-amber-950/25 text-amber-100"
                : "border-emerald-900/50 bg-emerald-950/20 text-emerald-200/90"
            }`}
          >
            <p className="font-semibold text-[13px]">Pathway inhibitor vs use</p>
            {hasPathwayIssue ? (
              <ul className="mt-2 list-inside list-disc space-y-1.5 text-[13px] leading-snug text-amber-100/95">
                {conflicts.map((c, idx) => (
                  <li key={`${c.pathway}-${c.inhibitor}-${c.substrate}-${idx}`}>
                    <span className="font-medium">{c.inhibitor}</span> inhibits{" "}
                    <span className="font-mono text-xs">{c.pathway}</span> while{" "}
                    <span className="font-medium">{c.substrate}</span> depends on
                    that pathway (substrate).
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[13px] leading-relaxed text-emerald-100/80">
                No inhibitor is paired with another medication that uses the same
                pathway as a substrate.
              </p>
            )}
          </div>

          {cumulativeWarning ? (
            <div
              role="status"
              className="rounded-xl border border-amber-500/50 bg-amber-950/35 px-3 py-3 text-[13px] font-medium leading-relaxed text-amber-50"
            >
              {cumulativeWarning}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-300 bg-slate-50/95 px-3 py-2.5 text-[13px] leading-relaxed text-slate-400">
              Cumulative OH / dizziness: high-risk band starts above three meds
              with either label on this screen (each med counts once).
            </p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-dashed border-slate-300/80 bg-gradient-to-b from-slate-900/90 to-slate-950/95 shadow-[inset_0_2px_12px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.06]">
        <div className="border-b border-slate-300 bg-white/98 px-4 py-3">
          <h2
            id="med-list-heading"
            className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500"
          >
            Current list
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {medications.length} medication{medications.length === 1 ? "" : "s"}{" "}
            — scroll for longer regimens (journal layout).
          </p>
        </div>

        <div
          className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-y-contain scroll-smooth"
          style={{ scrollbarGutter: "stable" }}
        >
          {medications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No medications saved yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800/90">
              {medications.map((m, index) => (
                <li
                  key={m.id}
                  className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-mono text-[10px] tabular-nums text-slate-600"
                        aria-hidden
                      >
                        {String(index + 1).padStart(2, "0")}.
                      </span>
                      <p className="truncate font-medium text-slate-900">
                        {m.name}
                      </p>
                    </div>
                    <p className="mt-0.5 pl-7 text-sm text-slate-400">
                      {m.pathway}
                    </p>
                    {m.pathway_role && (
                      <p className="mt-0.5 pl-7 text-xs text-slate-500">
                        {m.pathway_role}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 pl-7 text-xs sm:pl-0">
                    {m.is_inhibitor && (
                      <span className="rounded-full bg-amber-950/80 px-2 py-1 text-amber-200 ring-1 ring-amber-700/50">
                        Inhibitor
                      </span>
                    )}
                    {m.is_substrate && (
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-700 ring-1 ring-slate-600">
                        Substrate
                      </span>
                    )}
                    {m.has_orthostatic_hypotension && (
                      <span className="rounded-full bg-rose-950/80 px-2 py-1 text-rose-200 ring-1 ring-rose-700/50">
                        Orthostatic BP
                      </span>
                    )}
                    {m.has_dizziness_side_effect && (
                      <span className="rounded-full bg-violet-950/80 px-2 py-1 text-violet-200 ring-1 ring-violet-700/50">
                        Dizziness
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
