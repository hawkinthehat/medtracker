"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { checkOHCumulativeRisk } from "@/lib/metabolic";
import {
  SAFETY_OVERLAP_NOTE,
  resolveAuditedMedication,
  shouldWarnMetabolicOverlap,
} from "@/lib/metabolic-check";
import { buildDoseFrequencyDisplayLine } from "@/lib/medication-dose-frequency-save";
import { defaultDoseMgForMedicationName } from "@/lib/medication-dose-defaults";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import { setMedicationsAndPersist } from "@/lib/medications-persist";
import { getActiveMedications } from "@/lib/medication-active";
import type { FrequencyHint, SavedMedication } from "@/lib/seed-medications";
import MedicationsSafetyPanel from "@/components/meds/MedicationsSafetyPanel";
import MedicationEditRemoveModal from "@/components/meds/MedicationEditRemoveModal";
import DoseAdjustmentModal from "@/components/planner/DoseAdjustmentModal";
import DailySchedule from "@/components/DailySchedule";
import { upsertUserMedicationRemote } from "@/lib/supabase/user-medications";
import {
  timesForFrequency,
} from "@/lib/medication-dose-frequency-save";
import { upsertPublicMedicationRemote } from "@/lib/supabase/medications-timeline";

const FREQUENCY_LABELS: Record<FrequencyHint, string> = {
  "1x": "1× daily",
  "2x": "2× daily",
  "3x": "3× daily",
  prn: "PRN",
};

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
  const [doseMg, setDoseMg] = useState(20);
  const [frequencyHint, setFrequencyHint] = useState<FrequencyHint>("2x");
  const [medMenu, setMedMenu] = useState<SavedMedication | null>(null);
  const [fullDoseMed, setFullDoseMed] = useState<SavedMedication | null>(null);

  const auditedDraft = useMemo(
    () => resolveAuditedMedication(name),
    [name],
  );

  const activeMedications = useMemo(
    () => getActiveMedications(medications),
    [medications],
  );

  const medsForAdditive = useMemo(() => {
    const trimmed = auditedDraft.name.trim();
    if (!trimmed) return activeMedications;
    return [...activeMedications, { ...auditedDraft, id: "__draft__" }];
  }, [activeMedications, auditedDraft]);

  const cumulativePositionalWarning = useMemo(
    () => checkOHCumulativeRisk(medsForAdditive),
    [medsForAdditive],
  );

  const metabolicOverlapWarn = useMemo(
    () =>
      auditedDraft.name.trim()
        ? shouldWarnMetabolicOverlap(auditedDraft, activeMedications)
        : false,
    [auditedDraft, activeMedications],
  );

  const addMutation = useMutation({
    mutationFn: async (med: SavedMedication) => med,
    onSuccess: async (med) => {
      setMedicationsAndPersist(qc, (prev = []) => [...prev, med]);
      await upsertUserMedicationRemote(med);
      const times = timesForFrequency(med.frequencyHint ?? "2x", undefined);
      void upsertPublicMedicationRemote(med, times);
      setName("");
      setDoseMg(20);
      setFrequencyHint("2x");
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const norm = trimmed.toLowerCase().replace(/\s+/g, " ");
    const duplicate = activeMedications.find(
      (m) => m.name.trim().toLowerCase().replace(/\s+/g, " ") === norm,
    );
    if (duplicate) {
      const ok = window.confirm(
        "This med is already in Tiaki. Do you want to update the dosage instead?",
      );
      if (ok) setFullDoseMed(duplicate);
      return;
    }

    const audited = resolveAuditedMedication(trimmed);
    const mg = Math.max(1, Math.round(doseMg));
    const doseLabel = buildDoseFrequencyDisplayLine(mg, "mg", frequencyHint);
    addMutation.mutate({
      ...audited,
      name: trimmed,
      id: crypto.randomUUID(),
      doseLabel,
      frequencyHint,
    });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Medications
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900">
          Add what you take — amount and how often. Your care team still sees the
          full clinical picture in reports.
        </p>
      </header>

      <DailySchedule />

      <MedicationsSafetyPanel
        medications={activeMedications}
        onEditRemove={setMedMenu}
      />

      <MedicationEditRemoveModal
        med={medMenu}
        open={!!medMenu}
        onClose={() => setMedMenu(null)}
        onOpenAdvanced={(m) => {
          setMedMenu(null);
          setFullDoseMed(m);
        }}
      />

      <DoseAdjustmentModal
        med={fullDoseMed}
        open={!!fullDoseMed}
        initialTab="adjust"
        onClose={() => setFullDoseMed(null)}
      />

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
            htmlFor="med-dose-mg"
            className="text-sm font-semibold text-slate-900"
          >
            Dose (mg)
          </label>
          <input
            id="med-dose-mg"
            inputMode="numeric"
            type="number"
            min={1}
            max={4000}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-4 text-2xl font-bold tabular-nums text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={doseMg}
            onChange={(e) =>
              setDoseMg(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
            }
          />
          {name.trim() ? (
            <p className="mt-1 text-xs font-medium text-slate-600">
              Suggested starting amount for this name:{" "}
              {defaultDoseMgForMedicationName(name)} mg (you can change it).
            </p>
          ) : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-900">
            How often per day
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(FREQUENCY_LABELS) as FrequencyHint[]).map((fh) => (
              <button
                key={fh}
                type="button"
                className={`min-h-[52px] rounded-xl border-2 px-2 text-center text-sm font-bold ${
                  frequencyHint === fh
                    ? "border-sky-600 bg-sky-600 text-white"
                    : "border-slate-300 bg-gray-50 text-slate-900"
                }`}
                onClick={() => setFrequencyHint(fh)}
              >
                {FREQUENCY_LABELS[fh]}
              </button>
            ))}
          </div>
        </fieldset>

        {metabolicOverlapWarn && (
          <div
            role="status"
            className="rounded-xl border-4 border-amber-600 bg-amber-50 px-4 py-5 text-xl font-bold leading-snug text-slate-900"
          >
            {SAFETY_OVERLAP_NOTE}
          </div>
        )}

        {cumulativePositionalWarning && (
          <div
            role="status"
            className="rounded-xl border-4 border-amber-600 bg-amber-50 px-4 py-3 text-base font-semibold leading-relaxed text-slate-900"
          >
            {cumulativePositionalWarning}
          </div>
        )}

        <button
          type="submit"
          className="min-h-[56px] w-full rounded-xl border-4 border-black bg-sky-600 py-3 text-lg font-bold text-white hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50"
          disabled={!name.trim() || addMutation.isPending}
        >
          Add medication
        </button>
      </form>
    </div>
  );
}
