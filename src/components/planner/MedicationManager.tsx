"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pill, ChevronUp, History, Settings2 } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  checkMetabolicConflict,
  getCyp3a4BottleneckHint,
} from "@/lib/metabolic";
import {
  buildMedicationLookupCatalog,
  resolveMedicationDraftFromCatalog,
} from "@/lib/medication-name-resolve";
import { qk } from "@/lib/query-keys";
import {
  SEED_SAVED_MEDICATIONS,
  type SavedMedication,
} from "@/lib/seed-medications";
import type { SafetyGateBlockEvent } from "@/lib/types";
import type { DoseModalTab } from "./DoseAdjustmentModal";

export type MedicationManagerProps = {
  /** When true, omit outer card chrome (used inside dashboard accordion). */
  embedded?: boolean;
  onOpenDoseModal: (med: SavedMedication, tab: DoseModalTab) => void;
};

function substrateForConflict(
  draft: { pathway: string; is_inhibitor: boolean; name: string },
  currentMeds: SavedMedication[]
): SavedMedication | undefined {
  return currentMeds.find(
    (med) =>
      med.pathway === draft.pathway && draft.is_inhibitor && med.is_substrate
  );
}

export default function MedicationManager({
  embedded = false,
  onOpenDoseModal,
}: MedicationManagerProps) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const { data: medications = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: async (): Promise<SavedMedication[]> => SEED_SAVED_MEDICATIONS,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const lookupCatalog = useMemo(
    () => buildMedicationLookupCatalog(medications),
    [medications]
  );

  const draftMed = useMemo(
    () => resolveMedicationDraftFromCatalog(query, lookupCatalog),
    [query, lookupCatalog]
  );

  const preview = useMemo(
    () =>
      draftMed.name.trim()
        ? checkMetabolicConflict(draftMed, medications)
        : null,
    [draftMed, medications]
  );

  const conflictSubstrate = useMemo(() => {
    if (!draftMed.name.trim() || !draftMed.is_inhibitor) return undefined;
    return substrateForConflict(draftMed, medications);
  }, [draftMed, medications]);

  const hasConflict =
    preview != null && !preview.isSafe && preview.severity === "RED_ALERT";

  const bottleneckMessage = conflictSubstrate
    ? `Warning: This will bottleneck ${conflictSubstrate.name} levels.`
    : null;

  const cyp3a4LiveHint = useMemo(
    () =>
      draftMed.name.trim()
        ? getCyp3a4BottleneckHint(draftMed, medications)
        : null,
    [draftMed, medications]
  );

  const addMutation = useMutation({
    mutationFn: async (med: SavedMedication) => med,
    onSuccess: (m) => {
      qc.setQueryData<SavedMedication[]>(qk.medications, (prev = []) => [
        ...prev,
        m,
      ]);
      setQuery("");
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
    const check = checkMetabolicConflict(draftMed, medications);
    if (!check.isSafe) {
      const conflict = medications.find(
        (m) =>
          m.pathway === draftMed.pathway &&
          draftMed.is_inhibitor &&
          m.is_substrate
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
            All ({medications.length})
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
            All ({medications.length})
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
            className={`rounded-[1.25rem] border bg-white/90 px-4 py-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)] transition-[box-shadow,border-color] ${
              hasConflict
                ? "border-red-500/90 shadow-[0_0_0_1px_rgba(239,68,68,0.5),0_0_28px_rgba(239,68,68,0.35)]"
                : "border-slate-300 focus-within:border-sky-500/50 focus-within:shadow-[inset_0_2px_8px_rgba(0,0,0,0.35),0_0_0_1px_rgba(56,189,248,0.25)]"
            }`}
          >
            <input
              id="smart-med-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a medication name…"
              autoComplete="off"
              className="w-full border-0 bg-transparent text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-0"
            />
          </div>

          {cyp3a4LiveHint && (
            <p
              className="text-sm font-semibold leading-snug text-amber-200/95"
              role="status"
            >
              {cyp3a4LiveHint}
            </p>
          )}

          {hasConflict && bottleneckMessage && !cyp3a4LiveHint && (
            <p className="text-sm font-semibold text-red-300" role="alert">
              {bottleneckMessage}
            </p>
          )}

          <div className="rounded-xl border border-slate-300 bg-slate-100/80 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Interaction preview
            </p>
            {query.trim() === "" ? (
              <p className="mt-2 text-sm text-slate-500">
                Type a drug name to preview pathway interactions against your
                current list.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {preview?.isSafe
                    ? preview.message
                    : preview?.message ?? "—"}
                </p>
                {recognized && (
                  <p className="mt-2 text-xs text-sky-300/90">
                    Matched profile: {draftMed.name} · {draftMed.pathway}
                    {draftMed.is_inhibitor ? " · inhibitor" : ""}
                    {draftMed.is_substrate ? " · substrate" : ""}
                  </p>
                )}
                {!recognized && query.trim() && (
                  <p className="mt-2 text-xs text-amber-200/80">
                    No saved profile for this spelling — preview uses “Other /
                    Unknown”. Refine on the{" "}
                    <Link
                      href="/meds"
                      className="font-medium text-sky-400 underline-offset-2 hover:underline"
                    >
                      Meds
                    </Link>{" "}
                    page for pathway flags.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={
                !draftMed.name.trim() || addMutation.isPending || hasConflict
              }
              className="rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to list
            </button>
            <Link
              href="/meds"
              className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-800"
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
        <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-slate-300/40">
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
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-800"
              >
                Done
              </button>
            </div>
            <ul className="max-h-[min(60vh,420px)] space-y-0 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
              {medications.length === 0 && (
                <li className="py-8 text-center text-sm text-slate-500">
                  No medications yet.
                </li>
              )}
              {medications.map((m) => (
                <li
                  key={m.id}
                  className="border-b border-slate-200 py-3 last:border-0"
                >
                  <button
                    type="button"
                    onClick={() => openDoseModal(m, "adjust")}
                    className="flex w-full items-start justify-between gap-3 rounded-lg px-1 py-1.5 text-left transition hover:bg-slate-800/60"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-slate-900">{m.name}</span>
                      {m.pathway_role && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {m.pathway_role}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-violet-400/90">
                        Tap for dose &amp; timing
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-100/90 px-2 py-1 text-xs text-slate-400 ring-1 ring-slate-700">
                      {m.pathway}
                    </span>
                  </button>
                  <div className="mt-3 flex items-center justify-end gap-2 px-1">
                    <button
                      type="button"
                      onClick={() => openDoseModal(m, "adjust")}
                      className="inline-flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-950/40 px-4 py-2.5 text-sm font-semibold text-violet-100 shadow-inner ring-1 ring-violet-900/50 transition hover:border-violet-400/60 hover:bg-violet-900/35 active:scale-[0.98] sm:flex-initial sm:min-w-0 sm:flex-none sm:px-3"
                      aria-label={`Adjust dose and schedule for ${m.name}`}
                      title="Dose & schedule"
                    >
                      <Settings2 className="h-5 w-5 shrink-0" aria-hidden />
                      <span className="sm:inline">Adjust</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openDoseModal(m, "history")}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100/90 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:bg-slate-800 hover:text-slate-900 active:scale-[0.98]"
                      aria-label={`Dosage history for ${m.name}`}
                      title="History"
                    >
                      <History className="h-5 w-5 shrink-0" aria-hidden />
                      <span className="hidden sm:inline">History</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
