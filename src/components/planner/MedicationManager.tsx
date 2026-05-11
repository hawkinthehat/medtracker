"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pill, ChevronUp, History, Settings2, Stethoscope } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  getCyp3a4BottleneckHint,
  previewMedicationInteraction,
} from "@/lib/metabolic";
import {
  buildMedicationLookupCatalog,
  resolveMedicationDraftFromCatalog,
} from "@/lib/medication-name-resolve";
import {
  addCalendarDays,
  calendarDayKeyLocal,
  getActiveMedications,
} from "@/lib/medication-active";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import { setMedicationsAndPersist } from "@/lib/medications-persist";
import type { SavedMedication } from "@/lib/seed-medications";
import type { SafetyGateBlockEvent } from "@/lib/types";
import type { DoseModalTab } from "./DoseAdjustmentModal";

export type MedicationManagerProps = {
  /** When true, omit outer card chrome (used inside dashboard accordion). */
  embedded?: boolean;
  onOpenDoseModal: (med: SavedMedication, tab: DoseModalTab) => void;
};

export default function MedicationManager({
  embedded = false,
  onOpenDoseModal,
}: MedicationManagerProps) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [isTemporary, setIsTemporary] = useState(false);
  const [tempDaysStr, setTempDaysStr] = useState("7");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [doctorInfoMed, setDoctorInfoMed] = useState<SavedMedication | null>(
    null,
  );
  const drawerRef = useRef<HTMLDivElement>(null);

  const { data: medications = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: fetchMedicationsQuery,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const activeMedications = useMemo(
    () => getActiveMedications(medications),
    [medications],
  );

  const lookupCatalog = useMemo(
    () => buildMedicationLookupCatalog(activeMedications),
    [activeMedications],
  );

  const draftMed = useMemo(
    () => resolveMedicationDraftFromCatalog(query, lookupCatalog),
    [query, lookupCatalog]
  );

  const preview = useMemo(
    () =>
      draftMed.name.trim()
        ? previewMedicationInteraction(draftMed, activeMedications)
        : null,
    [draftMed, activeMedications],
  );

  const hasConflict =
    preview != null && !preview.isSafe && preview.severity === "RED_ALERT";

  const cyp3a4LiveHint = useMemo(
    () =>
      draftMed.name.trim()
        ? getCyp3a4BottleneckHint(draftMed, activeMedications)
        : null,
    [draftMed, activeMedications],
  );

  const addMutation = useMutation({
    mutationFn: async (med: SavedMedication) => med,
    onSuccess: (m) => {
      setMedicationsAndPersist(qc, (prev = []) => [...prev, m]);
      setQuery("");
      setIsTemporary(false);
      setTempDaysStr("7");
    },
  });

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const t = window.setTimeout(() => drawerRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [drawerOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draftMed.name.trim()) return;
    const nDays = Math.max(1, Number.parseInt(tempDaysStr, 10));
    if (isTemporary && (!tempDaysStr.trim() || !Number.isFinite(nDays))) return;

    const check = previewMedicationInteraction(draftMed, activeMedications);
    if (!check.isSafe) {
      if (draftMed.is_inhibitor) {
        const conflict = activeMedications.find(
          (m) =>
            m.pathway === draftMed.pathway &&
            draftMed.is_inhibitor &&
            m.is_substrate,
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
            ],
          );
        }
      }
      return;
    }
    const startKey = calendarDayKeyLocal();
    addMutation.mutate({
      ...draftMed,
      id: crypto.randomUUID(),
      ...(isTemporary
        ? {
            isTemporary: true,
            tempStartDate: startKey,
            tempEndDate: addCalendarDays(startKey, nDays - 1),
            tempCourseEndLogged: false,
          }
        : {}),
    });
  }

  const recognized =
    query.trim() &&
    lookupCatalog.some(
      (m) => m.name.toLowerCase() === draftMed.name.toLowerCase()
    );

  function openDoseModal(m: SavedMedication, tab: DoseModalTab) {
    onOpenDoseModal(m, tab);
    setDrawerOpen(false);
  }

  const body = (
    <>
      {!embedded && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-300 bg-slate-50/95 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-violet-400" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-800">
              Medications
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100/90 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-slate-500 hover:bg-white"
          >
            <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
            All ({activeMedications.length})
          </button>
        </div>
      )}

      {embedded && (
        <div className="mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100/90 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-slate-500 hover:bg-white"
          >
            <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
            All ({activeMedications.length})
          </button>
        </div>
      )}

      <div className={embedded ? "space-y-4" : "space-y-4 p-4"}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="smart-med-input" className="sr-only">
            Smart Add medication
          </label>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-500">
            Smart Add
          </p>
          <div
            className={`rounded-2xl border-4 bg-white px-4 py-3 transition-[border-color,box-shadow] ${
              hasConflict
                ? "border-red-600 shadow-[0_0_0_1px_rgba(220,38,38,0.4)]"
                : "border-black"
            }`}
          >
            <input
              id="smart-med-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a medication name…"
              autoComplete="off"
              className="w-full border-0 bg-transparent text-lg font-semibold text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-0"
            />
          </div>

          {hasConflict && query.trim() !== "" && (
            <div
              className="rounded-2xl border-4 border-black bg-white px-4 py-5 shadow-sm"
              role="alert"
            >
              <p className="text-2xl font-black leading-snug text-slate-900">
                ⚠️ Potential Reaction: Consult your doctor before adding.
              </p>
              {preview?.message && (
                <p className="mt-3 text-base font-semibold leading-snug text-slate-800">
                  {preview.message}
                </p>
              )}
            </div>
          )}

          {cyp3a4LiveHint && (
            <p
              className="text-base font-semibold leading-snug text-amber-900"
              role="status"
            >
              {cyp3a4LiveHint}
            </p>
          )}

          <div className="rounded-2xl border-4 border-violet-200 bg-violet-50/90 px-4 py-4">
            <label className="flex cursor-pointer items-start gap-4">
              <input
                type="checkbox"
                className="mt-1 h-7 w-7 shrink-0 rounded border-slate-400"
                checked={isTemporary}
                onChange={(e) => setIsTemporary(e.target.checked)}
              />
              <span className="text-lg font-black leading-snug text-slate-900">
                Is this a temporary medication?
              </span>
            </label>
            {isTemporary && (
              <div className="mt-5">
                <label
                  htmlFor="temp-days-input"
                  className="block text-lg font-black text-slate-900"
                >
                  How many days?
                </label>
                <input
                  id="temp-days-input"
                  inputMode="numeric"
                  type="text"
                  autoComplete="off"
                  value={tempDaysStr}
                  onChange={(e) => setTempDaysStr(e.target.value)}
                  className="mt-3 w-full rounded-2xl border-4 border-black bg-white px-5 py-5 text-center font-mono text-5xl font-black tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-violet-300"
                  placeholder="7"
                />
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  Starts today ({calendarDayKeyLocal()}); ends after the last
                  day of the course.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border-4 border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
              Interaction preview
            </p>
            {query.trim() === "" ? (
              <p className="mt-2 text-base text-slate-600">
                Type a drug name to preview pathway interactions against your
                current list.
              </p>
            ) : (
              <>
                <p className="mt-2 text-base leading-relaxed text-slate-800">
                  {preview?.isSafe
                    ? preview.message
                    : (preview?.message ?? "—")}
                </p>
                {!recognized && query.trim() && (
                  <p className="mt-2 text-sm text-amber-900">
                    No saved profile for this spelling — preview uses “Other /
                    Unknown”. Refine on the{" "}
                    <Link
                      href="/meds"
                      className="font-bold text-sky-700 underline-offset-2 hover:underline"
                    >
                      Meds
                    </Link>{" "}
                    page for pathway flags.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="submit"
              disabled={
                !draftMed.name.trim() ||
                addMutation.isPending ||
                hasConflict ||
                (isTemporary &&
                  (!tempDaysStr.trim() ||
                    !Number.isFinite(Math.max(1, Number.parseInt(tempDaysStr, 10)))))
              }
              className="min-h-[60px] flex-1 rounded-2xl border-4 border-black bg-sky-600 px-6 text-lg font-black uppercase tracking-wide text-white shadow-lg hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to list
            </button>
            <Link
              href="/meds"
              className="flex min-h-[60px] flex-1 items-center justify-center rounded-2xl border-4 border-black bg-white px-4 text-lg font-bold text-slate-900 hover:bg-slate-50"
            >
              Advanced editor
            </Link>
          </div>
        </form>
      </div>
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="min-h-0">{body}</div>
      ) : (
        <section className="overflow-hidden rounded-2xl border-4 border-black bg-white shadow-sm">
          {body}
        </section>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close medication list"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="med-drawer-title"
            className="relative z-[71] max-h-[min(78vh,560px)] w-full overflow-hidden rounded-t-2xl border border-slate-300 border-b-0 bg-white shadow-2xl ring-1 ring-white/10 motion-safe:animate-slide-up-drawer"
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-600" />
            <div className="flex items-center justify-between gap-3 border-b border-slate-300 px-5 py-4">
              <h2
                id="med-drawer-title"
                className="text-lg font-semibold text-slate-900"
              >
                Your medications
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="min-h-[48px] rounded-xl border-2 border-black bg-white px-4 text-base font-bold text-slate-900 hover:bg-slate-50"
              >
                Done
              </button>
            </div>
            <ul className="max-h-[min(60vh,420px)] space-y-3 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
              {activeMedications.length === 0 && (
                <li className="py-8 text-center text-base font-medium text-slate-600">
                  No medications yet.
                </li>
              )}
              {activeMedications.map((m) => (
                <li key={m.id}>
                  <div className="rounded-2xl border-4 border-black bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => openDoseModal(m, "adjust")}
                        className="min-h-[60px] flex-1 text-left leading-tight text-slate-900"
                      >
                        <span className="block text-xl font-black">{m.name}</span>
                        {m.doseLabel ? (
                          <span className="mt-1 block text-lg font-bold text-slate-800">
                            {m.doseLabel}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-xl border-4 border-black bg-white"
                        aria-label={`Doctor info for ${m.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDoctorInfoMed(m);
                        }}
                      >
                        <Stethoscope
                          className="h-8 w-8 text-slate-900"
                          aria-hidden
                        />
                      </button>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      Tap name or Adjust for quick dose &amp; frequency
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openDoseModal(m, "adjust")}
                        className="inline-flex min-h-[52px] min-w-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-4 border-black bg-sky-50 px-4 text-base font-bold text-slate-900"
                        aria-label={`Adjust dose and schedule for ${m.name}`}
                      >
                        <Settings2 className="h-6 w-6 shrink-0" aria-hidden />
                        Adjust
                      </button>
                      <button
                        type="button"
                        onClick={() => openDoseModal(m, "history")}
                        className="inline-flex min-h-[52px] min-w-[44px] items-center justify-center gap-2 rounded-xl border-4 border-slate-300 bg-white px-4 text-base font-bold text-slate-900"
                        aria-label={`Dosage history for ${m.name}`}
                      >
                        <History className="h-6 w-6 shrink-0" aria-hidden />
                        History
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {doctorInfoMed && (
        <div className="fixed inset-0 z-[72] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border-4 border-black bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="doctor-info-title"
          >
            <h3
              id="doctor-info-title"
              className="text-2xl font-black text-slate-900"
            >
              {doctorInfoMed.name}
            </h3>
            {doctorInfoMed.doseLabel ? (
              <p className="mt-2 text-xl font-bold text-slate-900">
                {doctorInfoMed.doseLabel}
              </p>
            ) : null}
            <p className="mt-2 text-base font-semibold text-slate-600">
              For your care team — pathways &amp; metabolism flags
            </p>
            <dl className="mt-5 space-y-4 text-lg font-semibold text-slate-900">
              <div>
                <dt className="text-base font-bold text-slate-600">Pathway</dt>
                <dd className="mt-1">{doctorInfoMed.pathway}</dd>
              </div>
              {doctorInfoMed.pathway_role && (
                <div>
                  <dt className="text-base font-bold text-slate-600">
                    Clinical note
                  </dt>
                  <dd className="mt-1 font-medium">{doctorInfoMed.pathway_role}</dd>
                </div>
              )}
              <div>
                <dt className="text-base font-bold text-slate-600">Role</dt>
                <dd className="mt-1 font-medium">
                  {doctorInfoMed.is_inhibitor && "Pathway inhibitor"}
                  {doctorInfoMed.is_inhibitor && doctorInfoMed.is_substrate
                    ? " · "
                    : ""}
                  {doctorInfoMed.is_substrate && "Pathway substrate"}
                  {!doctorInfoMed.is_inhibitor && !doctorInfoMed.is_substrate
                    ? "Other / mixed clearance"
                    : ""}
                </dd>
              </div>
              {(doctorInfoMed.has_orthostatic_hypotension ||
                doctorInfoMed.has_dizziness_side_effect) && (
                <div>
                  <dt className="text-base font-bold text-slate-600">
                    Positional / dizziness labeling
                  </dt>
                  <dd className="mt-1 font-medium">
                    {doctorInfoMed.has_orthostatic_hypotension
                      ? "Orthostatic hypotension listed. "
                      : ""}
                    {doctorInfoMed.has_dizziness_side_effect
                      ? "Dizziness listed."
                      : ""}
                  </dd>
                </div>
              )}
            </dl>
            <button
              type="button"
              className="mt-8 min-h-[56px] w-full rounded-2xl border-4 border-black bg-white text-lg font-bold text-slate-900 hover:bg-slate-50"
              onClick={() => setDoctorInfoMed(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
