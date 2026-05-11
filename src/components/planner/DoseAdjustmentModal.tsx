"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Minus, Plus, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  checkMetabolicConflict,
  warnInhibitorDoseEscalation,
  type Medication,
} from "@/lib/metabolic";
import type {
  MedicationHistoryEntry,
  MedicationProfile,
  TaperPlan,
  TaperSegment,
  DoseUnit,
} from "@/lib/medication-profile-types";
import {
  formatDoseLabel,
  isTaperEligibleMed,
  toMg,
} from "@/lib/medication-profile-types";
import { defaultDoseMgForMedicationName } from "@/lib/medication-dose-defaults";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import type { SavedMedication } from "@/lib/seed-medications";
import {
  fetchMedicationHistoryFromSupabase,
  fetchMedicationProfilesFromSupabase,
  insertMedicationHistoryRow,
  loadTaperPlansMap,
  upsertMedicationProfileRemote,
  upsertTaperPlanRemote,
} from "@/lib/supabase/medication-history";
import { calendarDaysSinceStart } from "@/lib/taper-plan";

const REASON_PRESETS = [
  "Per Dr. advice",
  "Too much nausea",
  "Morning OH / orthostatic symptoms",
  "Side effects",
  "Other",
] as const;

export type DoseModalTab = "adjust" | "history" | "taper";

type Props = {
  med: SavedMedication | null;
  open: boolean;
  initialTab?: DoseModalTab;
  onClose: () => void;
};

export default function DoseAdjustmentModal({
  med,
  open,
  initialTab = "adjust",
  onClose,
}: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<DoseModalTab>(initialTab);

  const { data: medications = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: fetchMedicationsQuery,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: profiles = {} } = useQuery({
    queryKey: qk.medicationProfiles,
    queryFn: fetchMedicationProfilesFromSupabase,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
  });

  const { data: history = [] } = useQuery({
    queryKey: qk.medicationHistory,
    queryFn: async (): Promise<MedicationHistoryEntry[]> => {
      const remote = await fetchMedicationHistoryFromSupabase();
      return remote;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: taperPlans = {} } = useQuery({
    queryKey: qk.taperPlans,
    queryFn: loadTaperPlansMap,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const [doseValue, setDoseValue] = useState(20);
  const [doseUnit, setDoseUnit] = useState<DoseUnit>("mg");
  const [timeStr, setTimeStr] = useState("20:00");
  const [reason, setReason] = useState<string>(REASON_PRESETS[0]);
  const [reasonCustom, setReasonCustom] = useState("");

  const [taperStart, setTaperStart] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [taperSegments, setTaperSegments] = useState<TaperSegment[]>([
    { doseMg: 60, days: 7 },
    { doseMg: 30, days: 14 },
  ]);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || !med) return;
    const p = profiles[med.id];
    const baseMg = defaultDoseMgForMedicationName(med.name);
    setDoseValue(p?.doseValue ?? baseMg);
    setDoseUnit(p?.doseUnit ?? "mg");
    setTimeStr(p?.scheduledTimes?.[0] ?? "20:00");
    const tp = taperPlans[med.id];
    if (tp) {
      setTaperStart(tp.startDateKey);
      setTaperSegments(
        tp.segments.length ? tp.segments : [{ doseMg: baseMg, days: 7 }]
      );
    } else {
      setTaperStart(new Date().toISOString().slice(0, 10));
      setTaperSegments([
        { doseMg: p?.doseValue ?? baseMg, days: 7 },
        { doseMg: Math.max(5, Math.round((p?.doseValue ?? baseMg) / 2)), days: 14 },
      ]);
    }
  }, [open, med, profiles, taperPlans]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const resolvedReason =
    reason === "Other" ? reasonCustom.trim() || "Other" : reason;

  const profileForMed = med ? profiles[med.id] : undefined;
  const prevMgForWarn =
    profileForMed != null
      ? toMg(profileForMed.doseValue, profileForMed.doseUnit)
      : undefined;

  const metabolicPreview = useMemo(() => {
    if (!med) return null;
    const m: Medication = {
      name: med.name,
      pathway: med.pathway,
      is_inhibitor: med.is_inhibitor,
      is_substrate: med.is_substrate,
      has_orthostatic_hypotension: med.has_orthostatic_hypotension,
      has_dizziness_side_effect: med.has_dizziness_side_effect,
      pathway_role: med.pathway_role,
    };
    return checkMetabolicConflict(m, medications);
  }, [med, medications]);

  const nextMg = useMemo(
    () => toMg(doseValue, doseUnit),
    [doseValue, doseUnit]
  );

  const escalationWarning = useMemo(() => {
    if (!med) return null;
    const m: Medication = {
      name: med.name,
      pathway: med.pathway,
      is_inhibitor: med.is_inhibitor,
      is_substrate: med.is_substrate,
    };
    return warnInhibitorDoseEscalation(m, prevMgForWarn, nextMg, medications);
  }, [med, medications, prevMgForWarn, nextMg]);

  const historyForMed = useMemo(
    () =>
      med
        ? history.filter((h) => h.medicationId === med.id)
        : [],
    [history, med]
  );

  const saveAdjust = useMutation({
    mutationFn: async () => {
      if (!med) throw new Error("no med");
      if (!resolvedReason.trim()) throw new Error("reason");

      const prevProfile = profiles[med.id];
      const oldLabel = prevProfile
        ? formatDoseLabel(prevProfile.doseValue, prevProfile.doseUnit)
        : null;
      const newLabel = formatDoseLabel(doseValue, doseUnit);
      const oldTimes = prevProfile?.scheduledTimes ?? null;
      const newTimes = [timeStr.trim() || "20:00"];

      const doseChanged =
        !prevProfile ||
        prevProfile.doseValue !== doseValue ||
        prevProfile.doseUnit !== doseUnit;
      const timeChanged =
        !prevProfile ||
        JSON.stringify(prevProfile.scheduledTimes ?? []) !==
          JSON.stringify(newTimes);

      let changeKind: MedicationHistoryEntry["changeKind"] = "dose_time";
      if (doseChanged && !timeChanged) changeKind = "dose";
      else if (!doseChanged && timeChanged) changeKind = "time";

      const entry: MedicationHistoryEntry = {
        id: crypto.randomUUID(),
        medicationId: med.id,
        medicationName: med.name,
        recordedAt: new Date().toISOString(),
        changeKind,
        oldDoseLabel: oldLabel,
        newDoseLabel: newLabel,
        oldScheduledTimes: oldTimes,
        newScheduledTimes: newTimes,
        reason: resolvedReason.trim(),
      };

      const nextProfile: MedicationProfile = {
        doseValue,
        doseUnit,
        scheduledTimes: newTimes,
      };

      await insertMedicationHistoryRow(entry);
      await upsertMedicationProfileRemote(med.id, nextProfile);

      return { entry, nextProfile };
    },
    onSuccess: (data) => {
      if (!med) return;
      qc.setQueryData<MedicationHistoryEntry[]>(
        qk.medicationHistory,
        (prev = []) => [data.entry, ...prev]
      );
      qc.setQueryData<Record<string, MedicationProfile>>(
        qk.medicationProfiles,
        (prev = {}) => ({
          ...prev,
          [med.id]: data.nextProfile,
        })
      );
      qc.invalidateQueries({ queryKey: qk.medicationTimeline });
      qc.invalidateQueries({ queryKey: qk.medicationProfiles });
      onClose();
    },
  });

  const saveTaper = useMutation({
    mutationFn: async () => {
      if (!med) throw new Error("no med");
      if (!resolvedReason.trim()) throw new Error("reason");

      const plan: TaperPlan = {
        medicationId: med.id,
        medicationName: med.name,
        startDateKey: taperStart,
        segments: taperSegments.filter((s) => s.days > 0 && s.doseMg > 0),
      };

      const entry: MedicationHistoryEntry = {
        id: crypto.randomUUID(),
        medicationId: med.id,
        medicationName: med.name,
        recordedAt: new Date().toISOString(),
        changeKind: "taper",
        oldDoseLabel: profileForMed
          ? formatDoseLabel(profileForMed.doseValue, profileForMed.doseUnit)
          : null,
        newDoseLabel: `Taper ${plan.segments.map((s) => `${s.doseMg}mg×${s.days}d`).join(" → ")}`,
        oldScheduledTimes: profileForMed?.scheduledTimes ?? null,
        newScheduledTimes: profileForMed?.scheduledTimes ?? [timeStr],
        reason: resolvedReason.trim(),
        taperSegments: plan.segments,
      };

      await insertMedicationHistoryRow(entry);
      await upsertTaperPlanRemote(plan);

      return { entry, plan };
    },
    onSuccess: (data) => {
      if (!med) return;
      qc.setQueryData<MedicationHistoryEntry[]>(
        qk.medicationHistory,
        (prev = []) => [data.entry, ...prev]
      );
      qc.setQueryData<Record<string, TaperPlan>>(qk.taperPlans, (prev = {}) => ({
        ...prev,
        [med.id]: data.plan,
      }));
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
    setDoseValue((v) =>
      Math.min(sliderMax, Math.max(1, v + n))
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dose-modal-title"
        className="relative z-[81] m-0 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-500/80 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_25px_50px_-12px_rgba(0,0,0,0.5)] sm:m-4 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-300 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-violet-600/20 ring-1 ring-sky-500/30">
              <SlidersHorizontal
                className="h-5 w-5 text-sky-300"
                aria-hidden
              />
            </span>
            <div>
              <h2 id="dose-modal-title" className="text-lg font-semibold text-slate-900">
                Dose and timing
              </h2>
              <p className="mt-1 text-sm text-slate-400">{med.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-200 px-3 pt-2">
          {(
            [
              ["adjust", "Adjust"],
              ["history", "History"],
              ...(isTaperEligibleMed(med) ? ([["taper", "Taper"]] as const) : []),
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
                tab === id
                  ? "bg-slate-800 text-sky-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "adjust" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-300/90 bg-gradient-to-b from-slate-900 to-slate-950 p-4 ring-1 ring-slate-200/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Dose
                  </span>
                  <div className="flex rounded-full bg-gray-50 p-1 ring-1 ring-slate-700">
                    <button
                      type="button"
                      onClick={() => setDoseUnit("mg")}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        doseUnit === "mg"
                          ? "bg-sky-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-800"
                      }`}
                    >
                      mg
                    </button>
                    <button
                      type="button"
                      onClick={() => setDoseUnit("mcg")}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        doseUnit === "mcg"
                          ? "bg-sky-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-800"
                      }`}
                    >
                      mcg
                    </button>
                  </div>
                </div>
                <output
                  className="mt-4 block text-center font-mono text-4xl font-bold tabular-nums tracking-tight text-sky-100 sm:text-5xl"
                  aria-live="polite"
                >
                  {formatDoseLabel(
                    Math.min(doseValue, sliderMax),
                    doseUnit
                  )}
                </output>
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => stepDose(-1)}
                    disabled={doseValue <= 1}
                    className="flex h-14 min-w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-gray-50 text-slate-900 shadow-inner transition hover:border-sky-500/50 hover:bg-white disabled:opacity-30 active:scale-95"
                    aria-label="Decrease dose"
                  >
                    <Minus className="h-6 w-6" strokeWidth={2.5} />
                  </button>
                  <div className="min-w-0 flex-1 px-1">
                    <input
                      type="range"
                      min={1}
                      max={sliderMax}
                      step={doseUnit === "mg" ? 1 : 25}
                      value={Math.min(doseValue, sliderMax)}
                      onChange={(e) =>
                        setDoseValue(Number(e.target.value))
                      }
                      className="dose-range-slider h-4 w-full cursor-pointer rounded-full accent-sky-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => stepDose(1)}
                    disabled={doseValue >= sliderMax}
                    className="flex h-14 min-w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-gray-50 text-slate-900 shadow-inner transition hover:border-sky-500/50 hover:bg-white disabled:opacity-30 active:scale-95"
                    aria-label="Increase dose"
                  >
                    <Plus className="h-6 w-6" strokeWidth={2.5} />
                  </button>
                </div>
                <label className="mt-4 block text-center">
                  <span className="sr-only">Fine-tune amount</span>
                  <input
                    type="number"
                    min={1}
                    max={sliderMax}
                    value={doseValue}
                    onChange={(e) =>
                      setDoseValue(
                        Math.min(
                          sliderMax,
                          Math.max(1, Number(e.target.value) || 1)
                        )
                      )
                    }
                    className="mx-auto w-28 rounded-xl border border-slate-300 bg-gray-50 px-2 py-2 text-center font-mono text-lg text-sky-100 tabular-nums"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-slate-300/90 bg-slate-100/80 p-4 ring-1 ring-slate-200/60">
                <label
                  htmlFor="med-time"
                  className="flex items-center gap-2 text-sm font-medium text-slate-800"
                >
                  <Clock className="h-4 w-4 text-sky-400" aria-hidden />
                  Scheduled time
                </label>
                <input
                  id="med-time"
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="mt-3 min-h-[52px] w-full rounded-2xl border-2 border-slate-300 bg-gray-50 px-4 py-3 text-lg text-slate-900 transition focus:border-sky-500/70 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Example: move a bedtime dose later to ease morning orthostatic
                  symptoms.
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  Safety re-check (checkMetabolicConflict)
                </p>
                <div className="mt-2 space-y-2 rounded-xl border border-slate-300 bg-slate-100/70 px-3 py-3 text-sm">
                  <p
                    className={
                      metabolicPreview?.isSafe
                        ? "text-slate-700"
                        : "text-red-300"
                    }
                  >
                    {metabolicPreview?.message ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Saving writes dose &amp; time to Supabase and refreshes your
                    planner timeline.
                  </p>
                  {escalationWarning && (
                    <p className="font-semibold text-amber-200" role="alert">
                      {escalationWarning}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-800">
                  Reason for change
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-slate-900"
                >
                  {REASON_PRESETS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {reason === "Other" && (
                  <textarea
                    value={reasonCustom}
                    onChange={(e) => setReasonCustom(e.target.value)}
                    rows={2}
                    placeholder="Describe…"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-2 text-sm text-slate-900"
                  />
                )}
              </div>

              <button
                type="button"
                disabled={saveAdjust.isPending || !resolvedReason.trim()}
                onClick={() => saveAdjust.mutate()}
                className="w-full rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 py-4 text-base font-bold text-white shadow-lg shadow-sky-950/40 transition hover:from-sky-500 hover:to-sky-400 active:scale-[0.99] disabled:opacity-40"
              >
                Save dose &amp; schedule
              </button>
            </div>
          )}

          {tab === "history" && (
            <ul className="space-y-3">
              {historyForMed.length === 0 && (
                <li className="text-sm text-slate-500">No changes recorded yet.</li>
              )}
              {historyForMed.map((h) => (
                <li
                  key={h.id}
                  className="rounded-xl border border-slate-300 bg-slate-100/80 px-3 py-3 text-sm"
                >
                  <time
                    className="text-xs text-slate-500"
                    dateTime={h.recordedAt}
                  >
                    {new Date(h.recordedAt).toLocaleString()}
                  </time>
                  <p className="mt-1 text-slate-800">
                    <span className="font-medium text-sky-300">
                      {h.changeKind}
                    </span>
                    {h.oldDoseLabel || h.newDoseLabel ? (
                      <>
                        {": "}
                        {h.oldDoseLabel ?? "—"} → {h.newDoseLabel ?? "—"}
                      </>
                    ) : null}
                  </p>
                  {(h.oldScheduledTimes || h.newScheduledTimes) && (
                    <p className="mt-1 text-xs text-slate-400">
                      Times:{" "}
                      {(h.oldScheduledTimes ?? []).join(", ") || "—"} →{" "}
                      {(h.newScheduledTimes ?? []).join(", ") || "—"}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{h.reason}</p>
                </li>
              ))}
            </ul>
          )}

          {tab === "taper" && isTaperEligibleMed(med) && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Step down by stretch (e.g. 60 mg for 7 days, then 30 mg). Today’s
                active dose uses this schedule on the planner.
              </p>
              <div>
                <label className="text-sm font-medium text-slate-800">
                  Start date
                </label>
                <input
                  type="date"
                  value={taperStart}
                  onChange={(e) => setTaperStart(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Steps
                </p>
                {taperSegments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-300 bg-slate-50/95 p-3"
                  >
                    <label className="text-xs text-slate-400">
                      mg
                      <input
                        type="number"
                        min={1}
                        value={seg.doseMg}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setTaperSegments((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, doseMg: v || 1 } : r
                            )
                          );
                        }}
                        className="mt-1 block w-24 rounded border border-slate-300 bg-gray-50 px-2 py-2 text-slate-900"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Days
                      <input
                        type="number"
                        min={1}
                        value={seg.days}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setTaperSegments((rows) =>
                            rows.map((r, i) =>
                              i === idx ? { ...r, days: v || 1 } : r
                            )
                          );
                        }}
                        className="mt-1 block w-24 rounded border border-slate-300 bg-gray-50 px-2 py-2 text-slate-900"
                      />
                    </label>
                    {taperSegments.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTaperSegments((rows) =>
                            rows.filter((_, i) => i !== idx)
                          )
                        }
                        className="mb-1 text-xs text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setTaperSegments((rows) => [
                      ...rows,
                      { doseMg: Math.round(rows[rows.length - 1]?.doseMg ?? 10) / 2 || 5, days: 7 },
                    ])
                  }
                  className="text-sm font-medium text-sky-400 hover:text-sky-300"
                >
                  + Add step
                </button>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-800">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-slate-900"
                >
                  {REASON_PRESETS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {reason === "Other" && (
                  <textarea
                    value={reasonCustom}
                    onChange={(e) => setReasonCustom(e.target.value)}
                    rows={2}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-2 text-sm text-slate-900"
                  />
                )}
              </div>

              {med && taperPlans[med.id] && (
                <p className="text-xs text-slate-500">
                  Day{" "}
                  {calendarDaysSinceStart(taperPlans[med.id]!.startDateKey, new Date())}{" "}
                  of taper (from start date).
                </p>
              )}

              <button
                type="button"
                disabled={saveTaper.isPending || !resolvedReason.trim()}
                onClick={() => saveTaper.mutate()}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
              >
                Save taper plan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
