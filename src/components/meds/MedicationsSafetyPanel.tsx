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
    [medications],
  );

  const cumulativeWarning = useMemo(
    () => checkOHCumulativeRisk(medications),
    [medications],
  );

  const hasPathwayIssue = conflicts.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-900">
          Safety audit
        </h2>

        <div className="mt-4 space-y-3 text-sm">
          <div
            className={`rounded-xl border-2 px-3 py-2.5 ${
              hasPathwayIssue
                ? "border-amber-500 bg-amber-50"
                : "border-emerald-600 bg-emerald-50"
            }`}
          >
            <p className="font-semibold text-[13px] text-slate-900">
              Pathway inhibitor vs use
            </p>
            {hasPathwayIssue ? (
              <ul className="mt-2 list-inside list-disc space-y-1.5 text-[13px] font-medium leading-snug text-slate-900">
                {conflicts.map((c, idx) => (
                  <li key={`${c.pathway}-${c.inhibitor}-${c.substrate}-${idx}`}>
                    <span className="font-semibold">{c.inhibitor}</span> inhibits{" "}
                    <span className="font-mono text-xs text-slate-900">
                      {c.pathway}
                    </span>{" "}
                    while{" "}
                    <span className="font-semibold">{c.substrate}</span> depends on
                    that pathway (substrate).
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-slate-900">
                No inhibitor is paired with another medication that uses the same
                pathway as a substrate.
              </p>
            )}
          </div>

          {cumulativeWarning ? (
            <div
              role="status"
              className="rounded-xl border-2 border-amber-500 bg-amber-50 px-3 py-3 text-[13px] font-semibold leading-relaxed text-slate-900"
            >
              {cumulativeWarning}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-[13px] font-medium leading-relaxed text-slate-900">
              Cumulative OH / dizziness: high-risk band starts above three meds
              with either label on this screen (each med counts once).
            </p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm ring-1 ring-slate-200/60">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2
            id="med-list-heading"
            className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-900"
          >
            Current list
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-900">
            {medications.length} medication{medications.length === 1 ? "" : "s"}{" "}
            — scroll for longer regimens (journal layout).
          </p>
        </div>

        <div
          className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-y-contain scroll-smooth"
          style={{ scrollbarGutter: "stable" }}
        >
          {medications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm font-medium text-slate-900">
              No medications saved yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {medications.map((m, index) => (
                <li
                  key={m.id}
                  className="flex flex-col gap-2 bg-white px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="font-mono text-[10px] tabular-nums text-slate-900"
                        aria-hidden
                      >
                        {String(index + 1).padStart(2, "0")}.
                      </span>
                      <p className="truncate font-semibold text-slate-900">
                        {m.name}
                      </p>
                    </div>
                    <p className="mt-0.5 pl-7 text-sm font-medium text-slate-900">
                      {m.pathway}
                    </p>
                    {m.pathway_role && (
                      <p className="mt-0.5 pl-7 text-xs font-medium text-slate-900">
                        {m.pathway_role}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 pl-7 text-xs sm:pl-0">
                    {m.is_inhibitor && (
                      <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-1 font-semibold text-slate-900">
                        Inhibitor
                      </span>
                    )}
                    {m.is_substrate && (
                      <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-1 font-semibold text-slate-900">
                        Substrate
                      </span>
                    )}
                    {m.has_orthostatic_hypotension && (
                      <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-1 font-semibold text-slate-900">
                        Orthostatic BP
                      </span>
                    )}
                    {m.has_dizziness_side_effect && (
                      <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-1 font-semibold text-slate-900">
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
