"use client";

import { useMemo } from "react";
import { checkOHCumulativeRisk } from "@/lib/metabolic";
import type { SavedMedication } from "@/lib/seed-medications";

type Props = {
  medications: SavedMedication[];
  /** Opens medication settings for this row. */
  onEditRemove?: (med: SavedMedication) => void;
};

export default function MedicationsSafetyPanel({
  medications,
  onEditRemove,
}: Props) {
  const cumulativeWarning = useMemo(
    () => checkOHCumulativeRisk(medications),
    [medications],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-900">
          Quick check
        </h2>

        <div className="mt-4 space-y-3 text-sm">
          {cumulativeWarning ? (
            <div
              role="status"
              className="rounded-xl border-2 border-amber-500 bg-amber-50 px-3 py-3 text-[13px] font-semibold leading-relaxed text-slate-900"
            >
              {cumulativeWarning}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-[13px] font-medium leading-relaxed text-slate-900">
              Several medications together can increase dizziness or fainting
              risk when standing up. Your list looks within a typical range here.
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
            {medications.length} medication{medications.length === 1 ? "" : "s"}
            . Tap a card to open settings.
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
                <li key={m.id} className="bg-white">
                  <button
                    type="button"
                    disabled={!onEditRemove}
                    onClick={() => onEditRemove?.(m)}
                    className={`flex w-full flex-col px-4 py-4 text-left transition ${
                      onEditRemove
                        ? "cursor-pointer hover:bg-sky-50 active:bg-sky-100"
                        : "cursor-default opacity-90"
                    }`}
                  >
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
                    {m.doseLabel ? (
                      <p className="mt-2 pl-7 text-base font-bold text-slate-900">
                        {m.doseLabel}
                      </p>
                    ) : (
                      <p className="mt-2 pl-7 text-sm font-medium text-slate-600">
                        Tap to set amount and how often.
                      </p>
                    )}
                    <span
                      className={`mt-4 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl border-4 border-black px-4 text-base font-black uppercase tracking-wide ${
                        onEditRemove
                          ? "bg-sky-600 text-white shadow-md"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      Medication settings
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
