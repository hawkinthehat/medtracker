"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  fetchPainMapActiveBodyPartIds,
  fetchPainMapForBodyPart,
  upsertPainMapRow,
} from "@/lib/pain-map-db";
import { qk } from "@/lib/query-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { cn } from "@/lib/utils";
import {
  JOURNAL_PAIN_CATEGORIES,
  SYMPTOM_BODY_LABELS,
  journalBodyPartId,
  type JournalBodyRegion,
  type PainMapSymptomCategory,
  type SymptomBodyPartId,
} from "@/lib/symptom-map";

const VIEWBOX = { w: 120, h: 280 };

/** Head — shared with SymptomMapper silhouette scale. */
const HEAD_PATH =
  "M60 20c-8 0-15 5.5-16.5 13-.9 4-.3 8 1.6 11 1.4 2.3 3.8 4 6.4 4.4v4.6c0 2.2-1.8 4-4 4h-1.5c-1.1 0-2 .9-2 2v2.5c0 1.1.9 2 2 2h29c1.1 0 2-.9 2-2V57c0-1.1-.9-2-2-2h-1.5c-2.2 0-4-1.8-4-4v-4.6c2.6-.4 5-2.1 6.4-4.4 1.9-3 2.5-7 1.6-11C75 25.5 68 20 60 20z";

const TORSO_PATH = "M40 62 L80 62 L84 182 L36 182 Z";

const REGIONS: JournalBodyRegion[] = ["head", "torso", "hands", "feet"];

function regionFill(
  selected: boolean,
  active: boolean
): { fill: string; stroke: string } {
  if (selected) {
    return {
      fill: "rgba(56, 189, 248, 0.35)",
      stroke: "rgba(125, 211, 252, 1)",
    };
  }
  if (active) {
    return {
      fill: "rgba(248, 113, 113, 0.22)",
      stroke: "rgba(248, 113, 113, 0.9)",
    };
  }
  return {
    fill: "rgba(255, 255, 255, 0.07)",
    stroke: "rgba(148, 163, 184, 0.5)",
  };
}

type BodyChartProps = {
  side: "front" | "back";
  selectedId: SymptomBodyPartId | null;
  activeIds: Set<string>;
  onSelectRegion: (id: SymptomBodyPartId) => void;
};

function BodyChart({
  side,
  selectedId,
  activeIds,
  onSelectRegion,
}: BodyChartProps) {
  const flip = side === "back";

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      className="h-auto w-full max-w-[min(100%,240px)] touch-manipulation select-none"
      role="img"
      aria-label={`${side === "front" ? "Front" : "Back"} body map`}
    >
      <title>{side === "front" ? "Front" : "Back"} human silhouette</title>
      <defs>
        <linearGradient id={`sil-${side}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(51 65 85)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(51 65 85)" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <g
        transform={flip ? `translate(${VIEWBOX.w} 0) scale(-1 1)` : undefined}
      >
        {/* Soft silhouette read layer */}
        <path
          d={`${HEAD_PATH} ${TORSO_PATH}`}
          fill={`url(#sil-${side}-fade)`}
          stroke="rgba(148,163,184,0.2)"
          strokeWidth={1}
          className="pointer-events-none"
        />

        {REGIONS.map((region) => {
          const id = journalBodyPartId(side, region);
          const selected = selectedId === id;
          const active = activeIds.has(id);
          const { fill, stroke } = regionFill(selected, active);
          const label = SYMPTOM_BODY_LABELS[id];

          if (region === "head") {
            return (
              <path
                key={id}
                d={HEAD_PATH}
                fill={fill}
                stroke={stroke}
                strokeWidth={selected ? 2.25 : 1.5}
                strokeLinejoin="round"
                className="cursor-pointer transition-[fill,stroke] duration-150"
                onClick={() => onSelectRegion(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectRegion(id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${label} — log pain`}
              />
            );
          }

          if (region === "torso") {
            return (
              <path
                key={id}
                d={TORSO_PATH}
                fill={fill}
                stroke={stroke}
                strokeWidth={selected ? 2.25 : 1.5}
                strokeLinejoin="round"
                className="cursor-pointer transition-[fill,stroke] duration-150"
                onClick={() => onSelectRegion(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectRegion(id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${label} — log pain`}
              />
            );
          }

          if (region === "hands") {
            return (
              <g
                key={id}
                role="button"
                tabIndex={0}
                aria-label={`${label} — log pain`}
                className="cursor-pointer outline-none transition-[opacity] duration-150"
                onClick={() => onSelectRegion(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectRegion(id);
                  }
                }}
              >
                <ellipse
                  cx={28}
                  cy={188}
                  rx={16}
                  ry={13}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={selected ? 2.25 : 1.5}
                />
                <ellipse
                  cx={92}
                  cy={188}
                  rx={16}
                  ry={13}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={selected ? 2.25 : 1.5}
                />
              </g>
            );
          }

          /* feet */
          return (
            <g
              key={id}
              role="button"
              tabIndex={0}
              aria-label={`${label} — log pain`}
              className="cursor-pointer outline-none transition-[opacity] duration-150"
              onClick={() => onSelectRegion(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectRegion(id);
                }
              }}
            >
              <ellipse
                cx={46}
                cy={268}
                rx={14}
                ry={10}
                fill={fill}
                stroke={stroke}
                strokeWidth={selected ? 2.25 : 1.5}
              />
              <ellipse
                cx={74}
                cy={268}
                rx={14}
                ry={10}
                fill={fill}
                stroke={stroke}
                strokeWidth={selected ? 2.25 : 1.5}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function JournalPainTracker() {
  const qc = useQueryClient();
  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

  const [open, setOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SymptomBodyPartId | null>(
    null
  );
  const [category, setCategory] =
    useState<PainMapSymptomCategory>("sfn_burning_tingling");
  const [intensity, setIntensity] = useState(5);

  const { data: activePartIds = [] } = useQuery({
    queryKey: qk.painMapActiveBodyParts,
    queryFn: fetchPainMapActiveBodyPartIds,
    staleTime: 30_000,
  });

  const { data: rowsForPart = [] } = useQuery({
    queryKey: selectedPart ? qk.painMap(selectedPart) : ["painMap", "none"],
    queryFn: () =>
      selectedPart
        ? fetchPainMapForBodyPart(selectedPart)
        : Promise.resolve([]),
    enabled: Boolean(selectedPart),
  });

  const activeKeys = useMemo(
    () => new Set(activePartIds),
    [activePartIds]
  );

  useEffect(() => {
    if (!open || !selectedPart) return;
    const row = rowsForPart.find((r) => r.category === category);
    if (row?.intensity != null) {
      setIntensity(
        Math.min(10, Math.max(1, Math.round(Number(row.intensity))))
      );
    } else {
      setIntensity(5);
    }
  }, [open, selectedPart, category, rowsForPart]);

  const invalidatePainQueries = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: qk.painMapActiveBodyParts });
    if (selectedPart) {
      await qc.invalidateQueries({ queryKey: qk.painMap(selectedPart) });
    }
  }, [qc, selectedPart]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPart) throw new Error("No region");
      const r = await upsertPainMapRow(selectedPart, category, intensity);
      if (!r.ok) throw new Error(r.error ?? "Save failed");
    },
    onSuccess: invalidatePainQueries,
  });

  const openRegion = useCallback((id: SymptomBodyPartId) => {
    setSelectedPart(id);
    setOpen(true);
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setSelectedPart(null);
  }, []);

  const regionTitle = selectedPart
    ? SYMPTOM_BODY_LABELS[selectedPart]
    : "Region";

  return (
    <section
      aria-labelledby="journal-pain-heading"
      className="rounded-2xl border border-slate-700 bg-slate-900/85 p-5 ring-1 ring-white/5"
    >
      <div className="space-y-1">
        <h2
          id="journal-pain-heading"
          className="text-sm font-bold uppercase tracking-[0.2em] text-sky-400"
        >
          Interactive pain map
        </h2>
        <p className="text-sm leading-relaxed text-slate-400">
          Tap <span className="text-slate-200">head</span>,{" "}
          <span className="text-slate-200">torso</span>,{" "}
          <span className="text-slate-200">hands</span>, or{" "}
          <span className="text-slate-200">feet</span> on the front or back
          figure — choose sensation type and severity. Saves to{" "}
          <code className="rounded bg-slate-950 px-1.5 py-0.5 text-xs text-sky-300">
            pain_map
          </code>
          .
        </p>
      </div>

      {!supabaseConfigured && (
        <p className="mt-4 rounded-lg border border-amber-800/60 bg-amber-950/35 px-3 py-2 text-sm text-amber-100">
          Configure{" "}
          <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to
          sync.
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-8">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Front
          </span>
          <BodyChart
            side="front"
            selectedId={selectedPart}
            activeIds={activeKeys}
            onSelectRegion={openRegion}
          />
        </div>
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Back
          </span>
          <BodyChart
            side="back"
            selectedId={selectedPart}
            activeIds={activeKeys}
            onSelectRegion={openRegion}
          />
        </div>
      </div>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="overflow-y-auto border-slate-700 px-6 pb-8 pt-2"
        >
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-slate-600 sm:hidden" />
          <SheetHeader className="border-b border-slate-800 pb-4 pt-4">
            <SheetTitle className="text-xl text-slate-50">{regionTitle}</SheetTitle>
            <SheetDescription>
              Pick how this area feels right now, then rate intensity.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            <fieldset>
              <legend className="text-sm font-medium text-slate-300">
                Sensation
              </legend>
              <div className="mt-3 flex flex-col gap-2">
                {JOURNAL_PAIN_CATEGORIES.map(({ label, category: cat }) => (
                  <label
                    key={cat}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                      category === cat
                        ? "border-sky-500/60 bg-sky-950/40 text-slate-50"
                        : "border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-600",
                    )}
                  >
                    <input
                      type="radio"
                      name="journal-pain-category"
                      value={cat}
                      checked={category === cat}
                      onChange={() => setCategory(cat)}
                      className="mt-0.5 h-4 w-4 shrink-0 border-slate-500 text-sky-600 focus:ring-sky-500"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="journal-pain-intensity"
                  className="text-sm font-medium text-slate-300"
                >
                  Severity
                </label>
                <span className="font-mono text-lg font-semibold tabular-nums text-sky-300">
                  {intensity}
                  <span className="text-sm font-normal text-slate-500"> / 10</span>
                </span>
              </div>
              <input
                id="journal-pain-intensity"
                type="range"
                min={1}
                max={10}
                step={1}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="mt-4 h-3 w-full cursor-pointer rounded-full accent-sky-500"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>Mild</span>
                <span>Severe</span>
              </div>
            </div>

            {saveMutation.isError && saveMutation.error instanceof Error && (
              <p className="text-sm font-medium text-red-400" role="alert">
                {saveMutation.error.message}
              </p>
            )}

            <button
              type="button"
              disabled={saveMutation.isPending || !selectedPart}
              onClick={() => saveMutation.mutate()}
              className="w-full rounded-xl bg-sky-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 hover:bg-sky-500 disabled:opacity-40"
            >
              Save to pain map
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
