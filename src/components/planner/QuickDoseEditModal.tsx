"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  DoseUnit,
  MedicationHistoryEntry,
  MedicationProfile,
} from "@/lib/medication-profile-types";
import { formatDoseLabel } from "@/lib/medication-profile-types";
import { defaultDoseMgForMedicationName } from "@/lib/medication-dose-defaults";
import { qk } from "@/lib/query-keys";
import type { FrequencyHint, SavedMedication } from "@/lib/seed-medications";
import { setMedicationsAndPersist } from "@/lib/medications-persist";
import {
  fetchMedicationProfilesFromSupabase,
  insertMedicationHistoryRow,
  upsertMedicationProfileRemote,
} from "@/lib/supabase/medication-history";

type Props = {
  med: SavedMedication | null;
  open: boolean;
  onClose: () => void;
  /** Opens the full DoseAdjustmentModal (tapers, history tabs, metabolic notes). */
  onOpenAdvanced: (med: SavedMedication) => void;
};

const FREQUENCY_LABELS: Record<FrequencyHint, string> = {
  "1x": "1× daily",
  "2x": "2× daily",
  "3x": "3× daily",
  prn: "PRN",
};

function buildDisplayLine(
  doseValue: number,
  doseUnit: DoseUnit,
  fh: FrequencyHint,
): string {
  return `${formatDoseLabel(doseValue, doseUnit)} · ${FREQUENCY_LABELS[fh]}`;
}

function timesForFrequency(
  fh: FrequencyHint,
  existing?: MedicationProfile,
): string[] {
  const t0 = existing?.scheduledTimes?.[0];
  const okTime = t0 && /^\d{2}:\d{2}$/.test(t0) ? t0 : undefined;
  switch (fh) {
    case "1x":
      return [okTime ?? "20:00"];
    case "2x":
      return okTime ? [okTime, "20:00"] : ["08:00", "20:00"];
    case "3x":
      return ["08:00", "14:00", "20:00"];
    case "prn":
      return [okTime ?? "12:00"];
    default:
      return ["20:00"];
  }
}

export default function QuickDoseEditModal({
  med,
  open,
  onClose,
  onOpenAdvanced,
}: Props) {
  const qc = useQueryClient();
  const [doseValue, setDoseValue] = useState(20);
  const [doseUnit, setDoseUnit] = useState<DoseUnit>("mg");
  const [frequencyHint, setFrequencyHint] = useState<FrequencyHint>("2x");

  const { data: profiles = {} } = useQuery({
    queryKey: qk.medicationProfiles,
    queryFn: fetchMedicationProfilesFromSupabase,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!open || !med) return;
    const p = profiles[med.id];
    const baseMg = defaultDoseMgForMedicationName(med.name);
    setDoseValue(p?.doseValue ?? baseMg);
    setDoseUnit(p?.doseUnit ?? "mg");
    setFrequencyHint(med.frequencyHint ?? "2x");
  }, [open, med, profiles]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!med) throw new Error("no med");
      const prevProfile = profiles[med.id];
      const oldLabel = prevProfile
        ? formatDoseLabel(prevProfile.doseValue, prevProfile.doseUnit)
        : med.doseLabel ?? null;
      const newLabel = formatDoseLabel(doseValue, doseUnit);
      const newTimes = timesForFrequency(frequencyHint, prevProfile);

      const doseChanged =
        !prevProfile ||
        prevProfile.doseValue !== doseValue ||
        prevProfile.doseUnit !== doseUnit;
      const timeChanged =
        !prevProfile ||
        JSON.stringify(prevProfile.scheduledTimes ?? []) !==
          JSON.stringify(newTimes);
      const freqChanged = (med.frequencyHint ?? "2x") !== frequencyHint;

      let changeKind: MedicationHistoryEntry["changeKind"] = "dose_time";
      if (doseChanged && !timeChanged && !freqChanged) changeKind = "dose";
      else if (!doseChanged && timeChanged && !freqChanged) changeKind = "time";

      const entry: MedicationHistoryEntry = {
        id: crypto.randomUUID(),
        medicationId: med.id,
        medicationName: med.name,
        recordedAt: new Date().toISOString(),
        changeKind,
        oldDoseLabel: oldLabel,
        newDoseLabel: newLabel,
        oldScheduledTimes: prevProfile?.scheduledTimes ?? null,
        newScheduledTimes: newTimes,
        reason: "Quick adjustment (Easy-Slide)",
      };

      const nextProfile: MedicationProfile = {
        doseValue,
        doseUnit,
        scheduledTimes: newTimes,
      };

      await insertMedicationHistoryRow(entry);
      await upsertMedicationProfileRemote(med.id, nextProfile);

      const displayLine = buildDisplayLine(doseValue, doseUnit, frequencyHint);

      return { entry, nextProfile, displayLine };
    },
    onSuccess: (data) => {
      if (!med) return;
      qc.setQueryData<MedicationHistoryEntry[]>(
        qk.medicationHistory,
        (prev = []) => [data.entry, ...prev],
      );
      qc.setQueryData<Record<string, MedicationProfile>>(
        qk.medicationProfiles,
        (prev = {}) => ({
          ...prev,
          [med.id]: data.nextProfile,
        }),
      );
      setMedicationsAndPersist(qc, (prev = []) =>
        prev.map((x) =>
          x.id === med.id
            ? {
                ...x,
                doseLabel: data.displayLine,
                frequencyHint,
              }
            : x,
        ),
      );
      qc.invalidateQueries({ queryKey: qk.medicationTimeline });
      qc.invalidateQueries({ queryKey: qk.medicationProfiles });
      onClose();
    },
  });

  if (!open || !med) return null;

  const sliderMax = doseUnit === "mg" ? 400 : 800;
  function stepDose(delta: number) {
    const step = doseUnit === "mg" ? 1 : 25;
    const n = Math.round(delta / Math.abs(delta)) * step;
    setDoseValue((v) => Math.min(sliderMax, Math.max(1, v + n)));
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-dose-title"
        className="relative z-[86] m-0 flex max-h-[min(92vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-4 border-black bg-white shadow-2xl sm:m-4 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b-4 border-black bg-sky-50 px-5 py-5">
          <div className="min-w-0">
            <p
              id="quick-dose-title"
              className="truncate text-2xl font-black leading-tight text-slate-900"
            >
              Adjust dose
            </p>
            <p className="mt-1 truncate text-xl font-bold text-slate-800">
              {med.name}
            </p>
          </div>
          <button
            type="button"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-4 border-black bg-white text-slate-900"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-8 w-8" aria-hidden />
          </button>
        </div>

        <div className="space-y-8 overflow-y-auto px-5 py-8">
          <div>
            <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
              Dose
            </p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-black bg-white text-4xl font-black text-slate-900 shadow-md active:scale-[0.98]"
                aria-label="Decrease dose"
                onClick={() => stepDose(-1)}
              >
                <Minus className="h-12 w-12" strokeWidth={3} aria-hidden />
              </button>
              <div className="min-w-[8rem] text-center">
                <p className="font-mono text-6xl font-black tabular-nums leading-none text-slate-900">
                  {doseUnit === "mg"
                    ? Number.isInteger(doseValue)
                      ? doseValue
                      : doseValue.toFixed(1).replace(/\.0$/, "")
                    : Math.round(doseValue)}
                </p>
                <p className="mt-2 text-lg font-bold uppercase tracking-wide text-slate-600">
                  {doseUnit}
                </p>
              </div>
              <button
                type="button"
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-black bg-sky-600 text-white shadow-md active:scale-[0.98]"
                aria-label="Increase dose"
                onClick={() => stepDose(1)}
              >
                <Plus className="h-12 w-12" strokeWidth={3} aria-hidden />
              </button>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                className={`min-h-[52px] rounded-2xl border-4 px-6 text-lg font-black uppercase tracking-wide ${
                  doseUnit === "mg"
                    ? "border-black bg-black text-white"
                    : "border-slate-300 bg-white text-slate-800"
                }`}
                onClick={() => setDoseUnit("mg")}
              >
                mg
              </button>
              <button
                type="button"
                className={`min-h-[52px] rounded-2xl border-4 px-6 text-lg font-black uppercase tracking-wide ${
                  doseUnit === "mcg"
                    ? "border-black bg-black text-white"
                    : "border-slate-300 bg-white text-slate-800"
                }`}
                onClick={() => setDoseUnit("mcg")}
              >
                mcg
              </button>
            </div>
          </div>

          <div>
            <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
              Frequency
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(FREQUENCY_LABELS) as FrequencyHint[]).map((fh) => (
                <button
                  key={fh}
                  type="button"
                  className={`min-h-[64px] rounded-2xl border-4 px-2 text-center text-base font-black leading-tight ${
                    frequencyHint === fh
                      ? "border-black bg-violet-600 text-white"
                      : "border-slate-300 bg-white text-slate-900"
                  }`}
                  onClick={() => setFrequencyHint(fh)}
                >
                  {FREQUENCY_LABELS[fh]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={confirmMutation.isPending}
            className="flex min-h-[72px] w-full items-center justify-center rounded-2xl border-4 border-black bg-emerald-600 px-6 text-xl font-black uppercase tracking-wide text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => confirmMutation.mutate()}
          >
            {confirmMutation.isPending ? "Saving…" : "Confirm change"}
          </button>

          <button
            type="button"
            className="flex min-h-[56px] w-full items-center justify-center rounded-2xl border-4 border-slate-400 bg-white px-4 text-lg font-bold text-slate-800 hover:bg-slate-50"
            onClick={() => {
              onClose();
              onOpenAdvanced(med);
            }}
          >
            Full editor (taper, history, warnings)
          </button>
        </div>
      </div>
    </div>
  );
}
