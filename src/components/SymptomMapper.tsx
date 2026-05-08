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
  deletePainMapRow,
  fetchPainMapActiveBodyPartIds,
  fetchPainMapForBodyPart,
  upsertPainMapRow,
} from "@/lib/pain-map-db";
import { qk } from "@/lib/query-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { cn } from "@/lib/utils";
import {
  SYMPTOM_BODY_LABELS,
  type PainMapSymptomCategory,
  type SymptomBodyPartId,
} from "@/lib/symptom-map";

const HEAD_PATH =
  "M60 20c-8 0-15 5.5-16.5 13-.9 4-.3 8 1.6 11 1.4 2.3 3.8 4 6.4 4.4v4.6c0 2.2-1.8 4-4 4h-1.5c-1.1 0-2 .9-2 2v2.5c0 1.1.9 2 2 2h29c1.1 0 2-.9 2-2V57c0-1.1-.9-2-2-2h-1.5c-2.2 0-4-1.8-4-4v-4.6c2.6-.4 5-2.1 6.4-4.4 1.9-3 2.5-7 1.6-11C75 25.5 68 20 60 20z";

const TORSO_PATH = "M40 62 L80 62 L84 182 L36 182 Z";

const ARMS_MERGED =
  "M38 64 L18 72 L12 132 L34 128 L40 68 Z M82 64 L102 72 L108 132 L86 128 L80 68 Z M34 128 L12 188 L24 194 L38 134 Z M86 128 L108 188 L96 194 L82 134 Z";

const LEGS_PATH =
  "M40 198 L34 272 L52 276 L56 202 Z M68 198 L74 272 L56 276 L52 202 Z";

const VIEWBOX = { w: 120, h: 280 };

type MapperSegment = "head" | "torso" | "arms" | "legs";

const SEGMENTS: MapperSegment[] = ["head", "torso", "arms", "legs"];

function mapperBodyPartId(
  side: "front" | "back",
  segment: MapperSegment
): SymptomBodyPartId {
  const prefix = side === "front" ? "front" : "back";
  if (segment === "head") return `${prefix}_head` as SymptomBodyPartId;
  if (segment === "torso") return `${prefix}_torso` as SymptomBodyPartId;
  if (segment === "arms") return `${prefix}_arms` as SymptomBodyPartId;
  return `${prefix}_legs` as SymptomBodyPartId;
}

function segmentPath(segment: MapperSegment): string | null {
  if (segment === "head") return HEAD_PATH;
  if (segment === "torso") return TORSO_PATH;
  if (segment === "arms") return ARMS_MERGED;
  if (segment === "legs") return LEGS_PATH;
  return null;
}

const SENSATIONS: {
  label: string;
  category: PainMapSymptomCategory;
  hint: string;
}[] = [
  {
    label: "Burning / SFN",
    category: "burning",
    hint: "Small-fiber neuropathy pattern",
  },
  {
    label: "Aching / Fibro",
    category: "deep_ache",
    hint: "Widespread pain / fibromyalgia",
  },
  {
    label: "MCAS rash",
    category: "mcas_rash",
    hint: "Cutaneous mast-cell activation",
  },
];

function segmentFill(
  selected: boolean,
  active: boolean
): { fill: string; stroke: string } {
  if (selected) {
    return {
      fill: "rgba(251, 191, 36, 0.35)",
      stroke: "rgba(251, 191, 36, 1)",
    };
  }
  if (active) {
    return {
      fill: "rgba(248, 113, 113, 0.2)",
      stroke: "rgba(248, 113, 113, 0.85)",
    };
  }
  return {
    fill: "rgba(255, 255, 255, 0.08)",
    stroke: "rgba(255, 255, 255, 0.45)",
  };
}

type BodySvgProps = {
  side: "front" | "back";
  selectedKey: string | null;
  activeKeys: Set<string>;
  onSelect: (id: SymptomBodyPartId) => void;
};

function BodySvg({ side, selectedKey, activeKeys, onSelect }: BodySvgProps) {
  const flip = side === "back";

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      className="h-auto w-full max-w-[220px] touch-manipulation"
      role="img"
      aria-label={`${side === "front" ? "Front" : "Back"} body map`}
    >
      <title>{side === "front" ? "Front" : "Back"} silhouette</title>
      <g
        transform={
          flip ? `translate(${VIEWBOX.w} 0) scale(-1 1)` : undefined
        }
      >
        {SEGMENTS.map((segment) => {
          const id = mapperBodyPartId(side, segment);
          const d = segmentPath(segment);
          if (!d) return null;
          const selected = selectedKey === id;
          const active = activeKeys.has(id);
          const { fill, stroke } = segmentFill(selected, active);
          return (
            <path
              key={id}
              d={d}
              fill={fill}
              stroke={stroke}
              strokeWidth={selected ? 2.25 : 1.5}
              strokeLinejoin="round"
              className="cursor-pointer transition-[fill,stroke] duration-150"
              onClick={() => onSelect(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${SYMPTOM_BODY_LABELS[id]} — open symptom drawer`}
            />
          );
        })}
      </g>
    </svg>
  );
}

export default function SymptomMapper() {
  const qc = useQueryClient();
  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SymptomBodyPartId | null>(
    null
  );
  const [category, setCategory] =
    useState<PainMapSymptomCategory>("burning");
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
    if (!sheetOpen || !selectedPart) return;
    const row = rowsForPart.find((r) => r.category === category);
    if (row?.intensity != null) {
      setIntensity(
        Math.min(10, Math.max(1, Math.round(Number(row.intensity))))
      );
    } else {
      setIntensity(5);
    }
  }, [sheetOpen, selectedPart, category, rowsForPart]);

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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPart) throw new Error("No region");
      const r = await deletePainMapRow(selectedPart, category);
      if (!r.ok) throw new Error(r.error ?? "Remove failed");
    },
    onSuccess: invalidatePainQueries,
  });

  const openRegion = useCallback((id: SymptomBodyPartId) => {
    setSelectedPart(id);
    setSheetOpen(true);
  }, []);

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setSelectedPart(null);
    }
  }, []);

  const err =
    saveMutation.isError && saveMutation.error instanceof Error
      ? saveMutation.error.message
      : deleteMutation.isError && deleteMutation.error instanceof Error
        ? deleteMutation.error.message
        : null;

  return (
    <section
      aria-labelledby="symptom-mapper-heading"
      className="rounded-2xl border-2 border-white/10 bg-black p-5 ring-2 ring-amber-500/30"
    >
      <div className="space-y-1">
        <h2
          id="symptom-mapper-heading"
          className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300"
        >
          Body symptom mapper
        </h2>
        <p className="text-sm leading-relaxed text-slate-700">
          Front and back views — tap <span className="text-white">head</span>,{" "}
          <span className="text-white">torso</span>,{" "}
          <span className="text-white">arms</span>, or{" "}
          <span className="text-white">legs</span>. High-contrast for flares.
          Saves to Supabase{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-amber-200">
            pain_map
          </code>
          .
        </p>
      </div>

      {!supabaseConfigured && (
        <p className="mt-4 rounded-lg border-2 border-amber-600 bg-amber-950/50 px-3 py-2 text-sm font-medium text-amber-100">
          Add{" "}
          <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to save.
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-8">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-white">
            Front
          </span>
          <BodySvg
            side="front"
            selectedKey={selectedPart}
            activeKeys={activeKeys}
            onSelect={openRegion}
          />
        </div>
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-white">
            Back
          </span>
          <BodySvg
            side="back"
            selectedKey={selectedPart}
            activeKeys={activeKeys}
            onSelect={openRegion}
          />
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="max-w-md overflow-y-auto border-l-4 border-amber-400 bg-black text-white">
          <SheetHeader className="border-b border-white/15">
            <SheetTitle className="text-xl text-white">
              {selectedPart
                ? SYMPTOM_BODY_LABELS[selectedPart]
                : "Symptoms"}
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              Pick a sensation and intensity (1–10). Stored per region and
              symptom type.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 px-6 pb-10 pt-6">
            <fieldset>
              <legend className="text-sm font-bold uppercase tracking-wide text-amber-300">
                Sensation
              </legend>
              <div className="mt-3 flex flex-col gap-2">
                {SENSATIONS.map(({ label, category: cat, hint }) => (
                  <label
                    key={cat}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors",
                      category === cat
                        ? "border-amber-400 bg-amber-500/15"
                        : "border-white/20 hover:border-white/40"
                    )}
                  >
                    <input
                      type="radio"
                      name="sensation"
                      checked={category === cat}
                      onChange={() => setCategory(cat)}
                      className="mt-1 h-4 w-4 border-white/40 text-amber-500"
                    />
                    <span>
                      <span className="font-semibold text-white">{label}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="intensity-slider"
                  className="text-sm font-bold uppercase tracking-wide text-amber-300"
                >
                  Intensity
                </label>
                <span className="font-mono text-2xl font-black tabular-nums text-white">
                  {intensity}
                  <span className="text-lg text-slate-500">/10</span>
                </span>
              </div>
              <input
                id="intensity-slider"
                type="range"
                min={1}
                max={10}
                step={1}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                className="mt-4 h-3 w-full cursor-pointer accent-amber-400"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={!supabaseConfigured || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="min-h-[52px] rounded-xl bg-amber-500 py-3 text-base font-bold text-black hover:bg-amber-400 disabled:opacity-40"
              >
                Save to pain map
              </button>
              <button
                type="button"
                disabled={!supabaseConfigured || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="rounded-xl border-2 border-white/25 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Remove this sensation from region
              </button>
            </div>

            {rowsForPart.length > 0 && (
              <div className="rounded-xl border border-white/15 bg-zinc-950 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Logged for this region
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  {rowsForPart.map((r) => (
                    <li
                      key={`${r.category}-${r.id}`}
                      className="flex justify-between gap-2 border-b border-white/10 pb-2 last:border-0"
                    >
                      <span className="text-slate-800">{r.category}</span>
                      <span className="font-mono text-amber-200">
                        {r.intensity != null ? `${r.intensity}/10` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {err && (
              <p className="text-sm font-medium text-red-400" role="alert">
                {err}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
