"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type {
  EpisodeEntry,
  OrthostaticSession,
  PainMapSnapshot,
  SafetyGateBlockEvent,
} from "@/lib/types";
import { PAIN_LABELS } from "@/components/planner/PainMapBody";
import {
  countSafetyGateBlocks30d,
  summarizeOrthostaticSystolic30d,
  symptomDensityByRegion30d,
} from "@/lib/clinical-summary-stats";

function fmtMmHg(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  return `${Math.round(n)}`;
}

export default function ClinicalSummaryCard() {
  const { data: orthostatic = [] } = useQuery<OrthostaticSession[]>({
    queryKey: qk.orthostatic,
    queryFn: async () => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: episodes = [] } = useQuery<EpisodeEntry[]>({
    queryKey: qk.episodes,
    queryFn: async () => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: painSnapshots = [] } = useQuery<PainMapSnapshot[]>({
    queryKey: qk.painSnapshots,
    queryFn: async () => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: safetyBlocks = [] } = useQuery<SafetyGateBlockEvent[]>({
    queryKey: qk.safetyGateBlocks,
    queryFn: async () => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const ortho = useMemo(
    () => summarizeOrthostaticSystolic30d(orthostatic),
    [orthostatic]
  );

  const density = useMemo(
    () => symptomDensityByRegion30d(episodes, painSnapshots),
    [episodes, painSnapshots]
  );

  const closeCalls = useMemo(
    () => countSafetyGateBlocks30d(safetyBlocks),
    [safetyBlocks]
  );

  const topRegions = useMemo(() => {
    const nonzero = density.filter((r) => r.flareEvents > 0);
    return nonzero.slice(0, 5);
  }, [density]);

  return (
    <section
      className="rounded-sm border border-slate-400/90 bg-[#f5f6f8] text-slate-900 shadow-[0_1px_0_0_rgba(15,23,42,0.06)] ring-1 ring-slate-300/60"
      aria-labelledby="clinical-summary-heading"
    >
      <div className="border-b border-slate-300/90 bg-white px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          Clinical extraction · rolling 30 days
        </p>
        <h2
          id="clinical-summary-heading"
          className="mt-1 font-serif text-xl font-semibold tracking-tight text-slate-900"
        >
          Summary for specialty review
        </h2>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-slate-600">
          Orthostatic BP averages use guided sessions with a 3-minute standing
          reading. Symptom density counts body regions logged on the pain map or
          episode entries with regional pain. Safety gate totals reflect blocked
          inhibitor/substrate additions on the Medications screen.
        </p>
      </div>

      <div className="divide-y divide-slate-300/80 px-5 py-1">
        <article className="py-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
            I. Systolic comparison — lying vs standing (3 min)
          </h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-slate-300/80 bg-white px-3 py-2.5">
              <dt className="text-[11px] font-medium text-slate-500">
                Mean lying SBP
              </dt>
              <dd className="mt-1 font-mono text-lg tabular-nums text-slate-900">
                {fmtMmHg(ortho.meanLyingSystolic)}{" "}
                <span className="text-xs font-sans font-normal text-slate-500">
                  mmHg
                </span>
              </dd>
            </div>
            <div className="rounded border border-slate-300/80 bg-white px-3 py-2.5">
              <dt className="text-[11px] font-medium text-slate-500">
                Mean standing SBP
              </dt>
              <dd className="mt-1 font-mono text-lg tabular-nums text-slate-900">
                {fmtMmHg(ortho.meanStandingSystolic)}{" "}
                <span className="text-xs font-sans font-normal text-slate-500">
                  mmHg
                </span>
              </dd>
            </div>
            <div className="rounded border border-slate-300/80 bg-white px-3 py-2.5">
              <dt className="text-[11px] font-medium text-slate-500">
                Mean ΔSBP (lying − standing)
              </dt>
              <dd className="mt-1 font-mono text-lg tabular-nums text-slate-900">
                {ortho.meanSystolicDrop === null
                  ? "—"
                  : `${ortho.meanSystolicDrop >= 0 ? "" : "−"}${Math.round(Math.abs(ortho.meanSystolicDrop))}`}{" "}
                <span className="text-xs font-sans font-normal text-slate-500">
                  mmHg
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Sessions included:{" "}
            <span className="tabular-nums text-slate-700">{ortho.sessionCount}</span>
            {ortho.sessionCount === 0 &&
              " — log orthostatic vitals with a 3-minute standing value for averages."}
          </p>
        </article>

        <article className="py-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
            II. Metabolic safety gate — inhibitor vs substrate blocks
          </h3>
          <p className="mt-3 font-mono text-3xl tabular-nums text-slate-900">
            {closeCalls}
            <span className="ml-2 font-sans text-sm font-normal text-slate-600">
              close-call{closeCalls === 1 ? "" : "s"} (30 d)
            </span>
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
            Each count is one blocked attempt to add a new pathway inhibitor that
            would interact with an existing substrate on the same enzyme route.
          </p>
        </article>

        <article className="py-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
            III. Symptom density — regional flare frequency
          </h3>
          {topRegions.length === 0 ? (
            <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
              No regional pain data in this window. Log episodes or save a pain
              map snapshot on the planner.
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {topRegions.map((row, idx) => (
                <li
                  key={row.region}
                  className="flex items-baseline justify-between gap-4 rounded border border-slate-300/70 bg-white px-3 py-2 text-[13px]"
                >
                  <span className="font-medium text-slate-800">
                    <span className="mr-2 font-mono text-xs text-slate-400">
                      {idx + 1}.
                    </span>
                    {PAIN_LABELS[row.region]}
                  </span>
                  <span className="font-mono tabular-nums text-slate-700">
                    {row.flareEvents}{" "}
                    <span className="font-sans text-[11px] font-normal text-slate-500">
                      logged flare{row.flareEvents === 1 ? "" : "s"}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>

      <footer className="border-t border-slate-300/90 bg-white px-5 py-3">
        <p className="text-[12px] leading-relaxed text-slate-600">
          <span className="font-medium text-slate-700">At a glance — </span>
          These are the same rolling figures your Missouri specialists can scan
          before diving into raw logs; share this screen or bundle it with the
          PDF export from Transfer.
        </p>
      </footer>
    </section>
  );
}
