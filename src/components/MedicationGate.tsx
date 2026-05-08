"use client";

import { useMemo, useState } from "react";
import type { Medication } from "@/lib/metabolic";
import {
  PRIMARY_PATHWAYS,
  checkMetabolicConflict,
  checkOrthostaticHypotensionAdditive,
} from "@/lib/metabolic";
import {
  SEED_SAVED_MEDICATIONS,
  type SavedMedication,
} from "@/lib/seed-medications";

const MOCK_CURRENT_MEDS: Medication[] = SEED_SAVED_MEDICATIONS.map(
  (row: SavedMedication) => {
    const { id: _, ...med } = row;
    void _;
    return med;
  }
);

export default function MedicationGate() {
  const [name, setName] = useState("");
  const [pathway, setPathway] = useState<string>(PRIMARY_PATHWAYS[0]);
  const [isInhibitor, setIsInhibitor] = useState(false);
  const [isSubstrate, setIsSubstrate] = useState(false);
  const [orthostaticSideEffect, setOrthostaticSideEffect] = useState(false);

  const draftMed = useMemo<Medication>(
    () => ({
      name: name.trim() || "(unnamed)",
      pathway,
      is_inhibitor: isInhibitor,
      is_substrate: isSubstrate,
      has_orthostatic_hypotension: orthostaticSideEffect || undefined,
    }),
    [name, pathway, isInhibitor, isSubstrate, orthostaticSideEffect]
  );

  const check = useMemo(
    () => checkMetabolicConflict(draftMed, MOCK_CURRENT_MEDS),
    [draftMed]
  );

  const additiveOrthostatic = useMemo(
    () =>
      checkOrthostaticHypotensionAdditive([...MOCK_CURRENT_MEDS, draftMed]),
    [draftMed]
  );

  const unsafe = !check.isSafe;

  return (
    <div
      className={`rounded-2xl border-2 p-4 shadow-lg transition-colors duration-200 sm:p-5 ${
        unsafe
          ? "border-red-600 bg-red-600 text-white ring-4 ring-red-500/50"
          : "border-slate-300 bg-white text-slate-900 ring-1 ring-white/10"
      }`}
      role="region"
      aria-label="Medication metabolic gate"
    >
      <h2
        className={`text-sm font-bold uppercase tracking-wider ${
          unsafe ? "text-red-100" : "text-slate-400"
        }`}
      >
        Medication gate
      </h2>
      <p
        className={`mt-1 text-xs ${
          unsafe ? "text-red-100/90" : "text-slate-500"
        }`}
      >
        Checking against current list:{" "}
        {MOCK_CURRENT_MEDS.map((m) => m.name).join(", ")}.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-xs font-medium text-slate-700">
          New medication name
          <input
            className="mt-1 w-full rounded-lg border border-slate-500 bg-gray-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-80"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., clarithromycin"
          />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Pathway
          <select
            className="mt-1 w-full rounded-lg border border-slate-500 bg-gray-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={pathway}
            onChange={(e) => setPathway(e.target.value)}
          >
            {PRIMARY_PATHWAYS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-slate-500"
              checked={isInhibitor}
              onChange={(e) => setIsInhibitor(e.target.checked)}
            />
            <span className={unsafe ? "text-white" : "text-slate-700"}>
              Inhibits this pathway
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-slate-500"
              checked={isSubstrate}
              onChange={(e) => setIsSubstrate(e.target.checked)}
            />
            <span className={unsafe ? "text-white" : "text-slate-700"}>
              Substrate of this pathway
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-slate-500"
              checked={orthostaticSideEffect}
              onChange={(e) => setOrthostaticSideEffect(e.target.checked)}
            />
            <span className={unsafe ? "text-white" : "text-slate-700"}>
              Lists orthostatic hypotension as a side effect
            </span>
          </label>
        </div>
      </div>

      {additiveOrthostatic && (
        <div
          className="mt-4 rounded-xl border border-amber-600/70 bg-amber-950/80 px-3 py-3 text-sm font-medium leading-relaxed text-amber-100"
          role="status"
          aria-live="polite"
        >
          Additive effects: {additiveOrthostatic}
        </div>
      )}

      <div
        className={`mt-4 rounded-xl border px-3 py-3 text-sm leading-relaxed ${
          unsafe
            ? "border-red-800 bg-red-700/90 font-medium text-white"
            : "border-slate-300 bg-slate-100/90 text-slate-700"
        }`}
        role="status"
        aria-live="polite"
      >
        {check.message}
      </div>
    </div>
  );
}
