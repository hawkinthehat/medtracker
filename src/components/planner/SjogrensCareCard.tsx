"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Droplet, GlassWater, Utensils } from "lucide-react";
import { useCallback, useState } from "react";
import { todayLocalDateKey } from "@/lib/clinical-correlation";
import { qk } from "@/lib/query-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  fetchClinicalMarkersForDate,
  upsertClinicalMarkers,
  type ClinicalMarkersRow,
} from "@/lib/supabase/clinical-markers";

function defaultRow(dateKey: string): ClinicalMarkersRow {
  return {
    date_key: dateKey,
    eye_drop_uses: 0,
    oral_rinses: 0,
    difficulty_swallowing_dry_food: false,
  };
}

export default function SjogrensCareCard() {
  const qc = useQueryClient();
  const dateKey = todayLocalDateKey();
  const [expanded, setExpanded] = useState(false);
  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

  const { data: row, isLoading } = useQuery({
    queryKey: qk.clinicalMarkers(dateKey),
    queryFn: async (): Promise<ClinicalMarkersRow> => {
      const remote = await fetchClinicalMarkersForDate(dateKey);
      return remote ?? defaultRow(dateKey);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const persist = useMutation({
    mutationFn: async (next: ClinicalMarkersRow) => {
      const res = await upsertClinicalMarkers(next);
      if (!res.ok) throw new Error(res.error ?? "Save failed");
      return next;
    },
  });

  const updateLocal = useCallback(
    (patch: Partial<ClinicalMarkersRow>) => {
      const prev =
        qc.getQueryData<ClinicalMarkersRow>(qk.clinicalMarkers(dateKey)) ??
        defaultRow(dateKey);
      const next: ClinicalMarkersRow = {
        ...prev,
        ...patch,
        date_key: dateKey,
      };
      qc.setQueryData(qk.clinicalMarkers(dateKey), next);
      if (supabaseConfigured) persist.mutate(next);
    },
    [dateKey, persist.mutate, qc, supabaseConfigured]
  );

  const eyeDrops = row?.eye_drop_uses ?? 0;
  const rinses = row?.oral_rinses ?? 0;
  const swallowHard = row?.difficulty_swallowing_dry_food ?? false;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-600 bg-slate-900/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/20">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        id="sjogren-care-trigger"
        aria-controls="sjogren-care-panel"
        className="flex w-full items-center justify-between gap-3 bg-slate-950/40 px-4 py-3.5 text-left transition hover:bg-slate-900/55"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-950/50 ring-1 ring-sky-800/50">
            <Droplet className="h-5 w-5 text-sky-300" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-500">
              Daily logging
            </p>
            <p className="truncate text-sm font-semibold text-slate-100">
              Sjögren&apos;s Care
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      <div
        id="sjogren-care-panel"
        role="region"
        aria-labelledby="sjogren-care-trigger"
        className={`grid border-t border-slate-800/90 transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 px-4 pb-4 pt-1">
            {!supabaseConfigured && (
              <p className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-100/90">
                Supabase is not configured — values stay on this device only until
                you add env keys.
              </p>
            )}
            {supabaseConfigured && persist.isError && (
              <p className="text-xs text-red-300" role="alert">
                {(persist.error as Error)?.message ?? "Could not sync."}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-xl border border-slate-700/90 bg-slate-950/45 p-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <Droplet className="h-4 w-4 shrink-0 text-sky-400" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Eye drop uses
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={isLoading || eyeDrops <= 0}
                    onClick={() =>
                      updateLocal({
                        eye_drop_uses: Math.max(0, eyeDrops - 1),
                      })
                    }
                    className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span
                    className="font-mono text-2xl font-bold tabular-nums text-slate-50"
                    aria-live="polite"
                  >
                    {eyeDrops}
                  </span>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => updateLocal({ eye_drop_uses: eyeDrops + 1 })}
                    className="rounded-lg border border-sky-700/60 bg-sky-950/40 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-950/60 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-slate-700/90 bg-slate-950/45 p-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <GlassWater className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Oral rinses
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={isLoading || rinses <= 0}
                    onClick={() =>
                      updateLocal({
                        oral_rinses: Math.max(0, rinses - 1),
                      })
                    }
                    className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span
                    className="font-mono text-2xl font-bold tabular-nums text-slate-50"
                    aria-live="polite"
                  >
                    {rinses}
                  </span>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => updateLocal({ oral_rinses: rinses + 1 })}
                    className="rounded-lg border border-cyan-800/50 bg-cyan-950/35 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-950/55 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700/90 bg-slate-950/45 p-3">
              <input
                type="checkbox"
                checked={swallowHard}
                disabled={isLoading}
                onChange={(e) =>
                  updateLocal({
                    difficulty_swallowing_dry_food: e.target.checked,
                  })
                }
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500"
              />
              <span className="flex items-start gap-2 text-sm leading-snug text-slate-200">
                <Utensils
                  className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                  aria-hidden
                />
                <span>
                  <span className="font-semibold text-slate-100">
                    Difficulty swallowing dry food
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Toggle if present today.
                  </span>
                </span>
              </span>
            </label>
            {supabaseConfigured && persist.isPending && (
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Saving…
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
