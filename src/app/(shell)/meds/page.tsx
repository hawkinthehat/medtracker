"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SafetyGateBlockEvent } from "@/lib/types";
import type { Medication } from "@/lib/metabolic";
import {
  PRIMARY_PATHWAYS,
  previewMedicationInteraction,
  checkOHCumulativeRisk,
} from "@/lib/metabolic";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import { setMedicationsAndPersist } from "@/lib/medications-persist";
import { getActiveMedications } from "@/lib/medication-active";
import type { SavedMedication } from "@/lib/seed-medications";
import MedicationsSafetyPanel from "@/components/meds/MedicationsSafetyPanel";
import DailySchedule from "@/components/DailySchedule";

export default function MedsPage() {
  const qc = useQueryClient();
  const { data: medications = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: fetchMedicationsQuery,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const [name, setName] = useState("");
  const [pathway, setPathway] = useState<string>(PRIMARY_PATHWAYS[0]);
  const [isInhibitor, setIsInhibitor] = useState(false);
  const [isSubstrate, setIsSubstrate] = useState(false);
  const [orthostaticSideEffect, setOrthostaticSideEffect] = useState(false);
  const [dizzinessSideEffect, setDizzinessSideEffect] = useState(false);
  const [alert, setAlert] = useState<ReturnType<
    typeof previewMedicationInteraction
  > | null>(null);

  const draftMed = useMemo<Medication>(
    () => ({
      name: name.trim(),
      pathway,
      is_inhibitor: isInhibitor,
      is_substrate: isSubstrate,
      has_orthostatic_hypotension: orthostaticSideEffect || undefined,
      has_dizziness_side_effect: dizzinessSideEffect || undefined,
    }),
    [name, pathway, isInhibitor, isSubstrate, orthostaticSideEffect, dizzinessSideEffect]
  );

  const activeMedications = useMemo(
    () => getActiveMedications(medications),
    [medications],
  );

  const medsForAdditive = useMemo(() => {
    const trimmed = draftMed.name.trim();
    if (!trimmed) return activeMedications;
    return [...activeMedications, { ...draftMed, id: "__draft__" }];
  }, [activeMedications, draftMed]);

  const cumulativePositionalWarning = useMemo(
    () => checkOHCumulativeRisk(medsForAdditive),
    [medsForAdditive]
  );

  const addMutation = useMutation({
    mutationFn: async (med: SavedMedication) => med,
    onSuccess: (med) => {
      setMedicationsAndPersist(qc, (prev = []) => [...prev, med]);
      setName("");
      setIsInhibitor(false);
      setIsSubstrate(false);
      setOrthostaticSideEffect(false);
      setDizzinessSideEffect(false);
      setAlert(null);
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!draftMed.name) return;
    const check = previewMedicationInteraction(draftMed, activeMedications);
    setAlert(check);
    if (!check.isSafe) {
      const conflict = activeMedications.find(
        (med) =>
          med.pathway === draftMed.pathway &&
          draftMed.is_inhibitor &&
          med.is_substrate
      );
      if (conflict) {
        qc.setQueryData<SafetyGateBlockEvent[]>(
          qk.safetyGateBlocks,
          (prev = []) => [
            {
              id: crypto.randomUUID(),
              recordedAt: new Date().toISOString(),
              pathway: draftMed.pathway,
              draftInhibitorName: draftMed.name.trim(),
              blockedSubstrateName: conflict.name,
            },
            ...prev,
          ]
        );
      }
      return;
    }
    addMutation.mutate({
      ...draftMed,
      id: crypto.randomUUID(),
    });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Medications
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900">
          Safety audit, scrollable journal list, and pathway screen when adding a
          new drug.
        </p>
      </header>

      <DailySchedule />

      <MedicationsSafetyPanel medications={activeMedications} />

      <form
        onSubmit={handleAdd}
        className="space-y-4 rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60"
      >
        <div>
          <label
            htmlFor="med-name"
            className="text-sm font-semibold text-slate-900"
          >
            Medication name
          </label>
          <input
            id="med-name"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-base text-slate-900 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="e.g., medication name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div>
          <label
            htmlFor="pathway"
            className="text-sm font-semibold text-slate-900"
          >
            Primary pathway
          </label>
          <select
            id="pathway"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={pathway}
            onChange={(e) => setPathway(e.target.value)}
          >
            {PRIMARY_PATHWAYS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs font-medium text-slate-900">
            CYP3A4 is listed first — it metabolizes a large share of common
            medications and is a frequent interaction hotspot.
          </p>
        </div>

        <fieldset className="flex flex-col gap-3 rounded-xl border border-slate-300 bg-slate-100/80 p-3">
          <legend className="px-1 text-sm font-semibold text-slate-900">
            Enzyme relationship
          </legend>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-900">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 bg-white text-sky-600 focus:ring-sky-500"
              checked={isInhibitor}
              onChange={(e) => setIsInhibitor(e.target.checked)}
            />
            This medication inhibits this pathway
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-900">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 bg-white text-sky-600 focus:ring-sky-500"
              checked={isSubstrate}
              onChange={(e) => setIsSubstrate(e.target.checked)}
            />
            This medication relies on this pathway (substrate)
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-900">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 bg-white text-sky-600 focus:ring-sky-500"
              checked={orthostaticSideEffect}
              onChange={(e) => setOrthostaticSideEffect(e.target.checked)}
            />
            Lists orthostatic hypotension as a side effect
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-900">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 bg-white text-sky-600 focus:ring-sky-500"
              checked={dizzinessSideEffect}
              onChange={(e) => setDizzinessSideEffect(e.target.checked)}
            />
            Lists dizziness as a side effect
          </label>
        </fieldset>

        {cumulativePositionalWarning && (
          <div
            role="status"
            className="rounded-xl border-4 border-amber-600 bg-amber-50 px-4 py-3 text-base font-semibold leading-relaxed text-slate-900"
          >
            {cumulativePositionalWarning}
          </div>
        )}

        {alert && (
          <div
            role="status"
            className={`rounded-xl border-4 px-4 py-3 text-base font-semibold leading-relaxed ${
              alert.severity === "RED_ALERT"
                ? "border-red-700 bg-red-50 text-slate-900"
                : "border-slate-300 bg-slate-50 text-slate-900"
            }`}
          >
            {alert.message}
          </div>
        )}

        <button
          type="submit"
          className="min-h-[56px] w-full rounded-xl border-4 border-black bg-sky-600 py-3 text-lg font-bold text-white hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50"
          disabled={!draftMed.name || addMutation.isPending}
        >
          Add medication
        </button>
      </form>
    </div>
  );
}
