"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { DoseUnit } from "@/lib/medication-profile-types";
import {
  addCalendarDays,
  calendarDayKeyLocal,
} from "@/lib/medication-active";
import { defaultDoseMgForMedicationName } from "@/lib/medication-dose-defaults";
import {
  persistMedicationDoseFrequencyChange,
  timesForFrequency,
} from "@/lib/medication-dose-frequency-save";
import { setMedicationsAndPersist } from "@/lib/medications-persist";
import { qk } from "@/lib/query-keys";
import type { FrequencyHint, SavedMedication } from "@/lib/seed-medications";
import { fetchMedicationProfilesFromSupabase } from "@/lib/supabase/medication-history";
import {
  deletePublicMedicationRemote,
  upsertPublicMedicationRemote,
} from "@/lib/supabase/medications-timeline";
import {
  deleteUserMedicationRemote,
  upsertUserMedicationRemote,
} from "@/lib/supabase/user-medications";

type Props = {
  med: SavedMedication | null;
  open: boolean;
  onClose: () => void;
  onOpenAdvanced?: (m: SavedMedication) => void;
};

const FREQ_CYCLE: FrequencyHint[] = ["1x", "2x", "3x", "prn"];

const FREQUENCY_LABELS: Record<FrequencyHint, string> = {
  "1x": "1× daily",
  "2x": "2× daily",
  "3x": "3× daily",
  prn: "PRN (as needed)",
};

function defaultEndDateKey(startKey: string): string {
  return addCalendarDays(startKey, 6);
}

export default function MedicationEditRemoveModal({
  med,
  open,
  onClose,
  onOpenAdvanced,
}: Props) {
  const qc = useQueryClient();
  const [doseValue, setDoseValue] = useState(20);
  const [doseUnit, setDoseUnit] = useState<DoseUnit>("mg");
  const [frequencyHint, setFrequencyHint] = useState<FrequencyHint>("2x");
  const [endDateKey, setEndDateKey] = useState("");
  const [tempCourseEnabled, setTempCourseEnabled] = useState(false);

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
    const start = med.tempStartDate ?? calendarDayKeyLocal();
    const end = med.tempEndDate ?? defaultEndDateKey(start);
    setEndDateKey(end);
    setTempCourseEnabled(Boolean(med.isTemporary));
  }, [open, med, profiles]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!med) throw new Error("no med");
      await persistMedicationDoseFrequencyChange(qc, {
        med,
        doseValue,
        doseUnit,
        frequencyHint,
        profiles,
        historyReason: "Medication settings",
      });
    },
    onSuccess: () => {
      onClose();
    },
  });

  const saveTempMutation = useMutation({
    mutationFn: async () => {
      if (!med) throw new Error("no med");
      const startKey = med.tempStartDate ?? calendarDayKeyLocal();
      let updated: SavedMedication;
      if (!tempCourseEnabled) {
        updated = {
          ...med,
          isTemporary: false,
          tempStartDate: undefined,
          tempEndDate: undefined,
          tempCourseEndLogged: false,
        };
      } else {
        if (!endDateKey.trim()) throw new Error("Pick an end date.");
        if (endDateKey < startKey)
          throw new Error("End date must be on or after start.");
        updated = {
          ...med,
          isTemporary: true,
          tempStartDate: startKey,
          tempEndDate: endDateKey,
          tempCourseEndLogged: false,
        };
      }
      setMedicationsAndPersist(qc, (prev = []) =>
        prev.map((x) => (x.id === med.id ? updated : x)),
      );
      const okUser = await upsertUserMedicationRemote(updated);
      if (!okUser) throw new Error("Could not sync to your account.");
      const times = timesForFrequency(
        updated.frequencyHint ?? "2x",
        profiles[med.id],
      );
      void upsertPublicMedicationRemote(updated, times);
      void qc.invalidateQueries({ queryKey: qk.medicationTimeline });
      void qc.invalidateQueries({ queryKey: qk.medications });
    },
    onSuccess: () => {
      onClose();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!med) throw new Error("no med");
      setMedicationsAndPersist(qc, (prev = []) =>
        prev.filter((x) => x.id !== med.id),
      );
      const okUser = await deleteUserMedicationRemote(med.id);
      if (!okUser) throw new Error("Could not remove from your account.");
      void deletePublicMedicationRemote(med.id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.medicationTimeline });
      void qc.invalidateQueries({ queryKey: qk.medications });
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

  function stepFrequency(delta: number) {
    let i = FREQ_CYCLE.indexOf(frequencyHint);
    if (i < 0) i = 1;
    const n = FREQ_CYCLE.length;
    const next = (i + delta + n * 4) % n;
    setFrequencyHint(FREQ_CYCLE[next]!);
  }

  const startKeyForTemp = med.tempStartDate ?? calendarDayKeyLocal();

  function confirmRemove() {
    if (!med) return;
    const ok = window.confirm(
      `Remove ${med.name} from your list? This cannot be undone.`,
    );
    if (!ok) return;
    removeMutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-[88] flex flex-col bg-white text-slate-900">
      <div className="flex items-center justify-between border-b-4 border-black px-4 py-4">
        <div className="min-w-0 pr-2">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">
            Medication settings
          </p>
          <h2
            id="med-settings-title"
            className="truncate text-2xl font-black leading-tight"
          >
            {med.name}
          </h2>
        </div>
        <button
          type="button"
          className="flex min-h-[52px] min-w-[52px] shrink-0 items-center justify-center rounded-xl border-4 border-black bg-white"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="h-8 w-8" strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8">
          <section
            aria-labelledby="dose-freq-heading"
            className="rounded-2xl border-4 border-black bg-sky-50 p-5"
          >
            <h3
              id="dose-freq-heading"
              className="text-center text-lg font-black uppercase tracking-wide text-slate-900"
            >
              Dose &amp; how often
            </h3>

            <p className="mt-6 text-center text-sm font-bold uppercase tracking-[0.2em] text-slate-700">
              Amount (mg / mcg)
            </p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-black bg-white text-4xl font-black shadow-md active:scale-[0.98]"
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
                <p className="mt-2 text-lg font-bold uppercase tracking-wide text-slate-700">
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
                className={`min-h-[52px] rounded-2xl border-4 px-6 text-lg font-black uppercase ${
                  doseUnit === "mg"
                    ? "border-black bg-black text-white"
                    : "border-slate-400 bg-white text-slate-900"
                }`}
                onClick={() => setDoseUnit("mg")}
              >
                mg
              </button>
              <button
                type="button"
                className={`min-h-[52px] rounded-2xl border-4 px-6 text-lg font-black uppercase ${
                  doseUnit === "mcg"
                    ? "border-black bg-black text-white"
                    : "border-slate-400 bg-white text-slate-900"
                }`}
                onClick={() => setDoseUnit("mcg")}
              >
                mcg
              </button>
            </div>

            <p className="mt-10 text-center text-sm font-bold uppercase tracking-[0.2em] text-slate-700">
              Times per day
            </p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-black bg-white shadow-md active:scale-[0.98]"
                aria-label="Fewer doses per day"
                onClick={() => stepFrequency(-1)}
              >
                <Minus className="h-12 w-12" strokeWidth={3} aria-hidden />
              </button>
              <div className="min-w-[10rem] text-center">
                <p className="text-2xl font-black leading-tight text-slate-900">
                  {FREQUENCY_LABELS[frequencyHint]}
                </p>
              </div>
              <button
                type="button"
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-black bg-violet-600 text-white shadow-md active:scale-[0.98]"
                aria-label="More doses per day or PRN"
                onClick={() => stepFrequency(1)}
              >
                <Plus className="h-12 w-12" strokeWidth={3} aria-hidden />
              </button>
            </div>

            <button
              type="button"
              disabled={saveMutation.isPending}
              className="mt-10 min-h-[72px] w-full rounded-2xl border-4 border-black bg-emerald-600 px-4 text-xl font-black uppercase tracking-wide text-white shadow-lg disabled:opacity-50"
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : "Save dose & schedule"}
            </button>
            {saveMutation.isError && (
              <p className="mt-3 text-center text-base font-bold text-red-700" role="alert">
                {saveMutation.error instanceof Error
                  ? saveMutation.error.message
                  : "Save failed."}
              </p>
            )}

            {onOpenAdvanced && (
              <button
                type="button"
                className="mt-4 min-h-[56px] w-full rounded-2xl border-4 border-slate-500 bg-white text-lg font-bold text-slate-900"
                onClick={() => {
                  onClose();
                  onOpenAdvanced(med);
                }}
              >
                Times, taper &amp; history
              </button>
            )}
          </section>

          <section
            aria-labelledby="temp-heading"
            className="rounded-2xl border-4 border-violet-300 bg-violet-50 p-5"
          >
            <h3
              id="temp-heading"
              className="text-lg font-black text-slate-900"
            >
              Short course (optional)
            </h3>
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-6 w-6 shrink-0 rounded border-slate-600"
                checked={tempCourseEnabled}
                onChange={(e) => setTempCourseEnabled(e.target.checked)}
              />
              <span className="text-base font-bold text-slate-900">
                Set an end date so this drops off your list automatically
              </span>
            </label>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Starts: <span className="font-mono">{startKeyForTemp}</span>
            </p>
            <label
              htmlFor="med-end-date"
              className="mt-4 block text-base font-black text-slate-900"
            >
              End date
            </label>
            <input
              id="med-end-date"
              type="date"
              min={startKeyForTemp}
              value={endDateKey}
              onChange={(e) => setEndDateKey(e.target.value)}
              className="mt-2 min-h-[56px] w-full rounded-2xl border-4 border-black bg-white px-4 py-3 text-lg font-bold text-slate-900"
            />
            <button
              type="button"
              disabled={saveTempMutation.isPending}
              className="mt-5 min-h-[60px] w-full rounded-2xl border-4 border-black bg-violet-600 px-4 text-lg font-black uppercase text-white disabled:opacity-50"
              onClick={() => saveTempMutation.mutate()}
            >
              {saveTempMutation.isPending ? "Saving…" : "Save end date"}
            </button>
            {saveTempMutation.isError && (
              <p className="mt-2 text-center text-sm font-bold text-red-700" role="alert">
                {saveTempMutation.error instanceof Error
                  ? saveTempMutation.error.message
                  : "Save failed."}
              </p>
            )}
          </section>

          <section
            aria-labelledby="delete-heading"
            className="mt-auto border-t-4 border-slate-300 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <h3 id="delete-heading" className="sr-only">
              Remove medication
            </h3>
            <button
              type="button"
              disabled={removeMutation.isPending}
              className="min-h-[80px] w-full rounded-2xl border-4 border-black bg-red-600 px-4 text-xl font-black uppercase tracking-wide text-white shadow-xl disabled:opacity-50"
              onClick={confirmRemove}
            >
              {removeMutation.isPending ? "Removing…" : "Remove medication"}
            </button>
            {removeMutation.isError && (
              <p className="mt-3 text-center text-base font-bold text-red-700" role="alert">
                {removeMutation.error instanceof Error
                  ? removeMutation.error.message
                  : "Remove failed."}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
