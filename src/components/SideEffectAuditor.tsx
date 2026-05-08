"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";
import { qk } from "@/lib/query-keys";
import {
  SEED_SAVED_MEDICATIONS,
  type SavedMedication,
} from "@/lib/seed-medications";
import type { ScheduledDose } from "@/lib/medication-schedule";
import { fetchMergedMedicationDoses } from "@/lib/merge-medication-doses";
import {
  auditSideEffect,
  matchesVomitingVitalsCrash,
  type SideEffectAuditFlag,
} from "@/lib/side-effect-audit";

const QUICK_TAGS = [
  "Dizziness",
  "Flushing",
  "Numbness",
  "Nausea",
  "Brain Fog",
] as const;

/** Matches `matchesVomitingVitalsCrash` in lib — separate chip for the metabolic rule. */
const VOMIT_CRASH_LABEL = "Vomiting / vitals crash";

function highlightFlags(
  flags: SideEffectAuditFlag[],
  symptom: string
): ReactNode[] {
  const out: ReactNode[] = [];
  for (const f of flags) {
    if (f.kind === "likely_contributor") {
      out.push(
        <li
          key="lc"
          className="rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2 text-sm text-amber-100"
        >
          <span className="font-semibold text-amber-200">
            Likely contributors
          </span>
          <span className="text-amber-100/90">
            {": "}
            {f.drugs.join(", ")}
          </span>
          <p className="mt-1 text-xs text-amber-200/80">{f.note}</p>
        </li>
      );
    }
    if (f.kind === "metabolic_bottleneck") {
      out.push(
        <li
          key="mb"
          className="rounded-lg border border-rose-500/35 bg-rose-950/35 px-3 py-2 text-sm text-rose-100"
        >
          <span className="font-semibold text-rose-200">
            Potential metabolic bottleneck
          </span>
          {f.inhibitors.length > 0 ? (
            <span className="text-rose-100/90">
              {": inhibitors on board — "}
              {f.inhibitors.join(", ")}
            </span>
          ) : null}
          <p className="mt-1 text-xs text-rose-200/80">{f.note}</p>
        </li>
      );
    }
  }
  if (
    matchesVomitingVitalsCrash(symptom) &&
    !flags.some((x) => x.kind === "metabolic_bottleneck")
  ) {
    out.push(
      <li
        key="no-inh"
        className="rounded-lg border border-slate-300 bg-slate-100/80 px-3 py-2 text-sm text-slate-700"
      >
        No CYP inhibitor matched on your med list or today&apos;s schedule for
        this check. Add inhibitors under Meds to refine bottleneck screening.
      </li>
    );
  }
  return out;
}

export default function SideEffectAuditor() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");

  const { data: medications = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: async (): Promise<SavedMedication[]> => SEED_SAVED_MEDICATIONS,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: doses = [] } = useQuery({
    queryKey: qk.medicationTimeline,
    queryFn: (): Promise<ScheduledDose[]> =>
      fetchMergedMedicationDoses(qc),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24 * 7,
  });

  const activeSymptom = query.trim();

  const { flags, probability } = useMemo(
    () => auditSideEffect(activeSymptom, medications, doses),
    [activeSymptom, medications, doses]
  );

  const flagItems = useMemo(
    () => highlightFlags(flags, activeSymptom),
    [flags, activeSymptom]
  );

  const filteredQuickTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...QUICK_TAGS, VOMIT_CRASH_LABEL];
    return [...QUICK_TAGS, VOMIT_CRASH_LABEL].filter((t) =>
      t.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
        <label htmlFor="side-effect-search" className="sr-only">
          Search or describe a symptom
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Symptom input
          </h2>
          <p className="text-xs text-slate-500">
            Cross-checks your saved med list and today&apos;s dose timeline.
          </p>
        </div>
        <input
          id="side-effect-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or type a symptom (e.g. dizziness, nausea)…"
          className="mt-4 w-full rounded-xl border border-slate-300 bg-slate-100/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          autoComplete="off"
        />

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Quick tags
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {filteredQuickTags.length === 0 ? (
              <span className="text-sm text-slate-500">
                No tags match &quot;{query.trim()}&quot; — clear search to see
                all tags.
              </span>
            ) : (
              filteredQuickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setQuery(tag)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                    activeSymptom === tag
                      ? "border-sky-500/60 bg-sky-950/50 text-sky-100"
                      : "border-slate-300 bg-slate-100/70 text-slate-700 hover:border-slate-500 hover:text-slate-900"
                  }`}
                >
                  {tag}
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      {activeSymptom ? (
        <>
          <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
            <div className="flex items-start gap-3">
              <Sparkles
                className="mt-0.5 h-5 w-5 shrink-0 text-sky-400"
                aria-hidden
              />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Probability card
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Heuristic only — not medical advice. Uses your stored med
                  profiles and scheduled doses.
                </p>
              </div>
            </div>
            {probability ? (
              <p className="mt-4 rounded-xl border border-sky-500/25 bg-sky-950/30 px-4 py-3 text-sm leading-relaxed text-slate-900">
                Based on your current meds, this symptom is most likely linked to{" "}
                <span className="font-semibold text-sky-200">
                  {probability.drugName}
                </span>{" "}
                due to{" "}
                <span className="text-slate-800">
                  {probability.pathwayLine}
                </span>
                .
              </p>
            ) : (
              <p className="mt-4 rounded-xl border border-slate-300 bg-slate-100/80 px-4 py-3 text-sm text-slate-400">
                No automated single-drug link for &quot;{activeSymptom}&quot;
                with your current list. Review flags below or add meds under{" "}
                <span className="text-slate-700">Meds</span>.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
                aria-hidden
              />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Cross-reference
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Rule-based flags from your medications table.
                </p>
              </div>
            </div>
            {flagItems.length > 0 ? (
              <ul className="mt-4 space-y-2">{flagItems}</ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No special flags for this wording. Try &quot;Dizziness&quot; or
                &quot;{VOMIT_CRASH_LABEL}&quot;.
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="text-center text-sm text-slate-500">
          Enter or choose a symptom to see the probability card and med
          cross-reference.
        </p>
      )}
    </div>
  );
}
