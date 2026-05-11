"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FeatureHelpTrigger } from "@/components/FeatureHelpModal";
import {
  BLURRY_VISION_LABEL,
  GENERAL_CATEGORY_ID,
  GENERAL_FATIGUE_LABEL,
  SYMPTOM_MATRIX_CATEGORY_LABEL,
  SYMPTOM_MATRIX_GRID,
  SYMPTOM_MATRIX_PILLAR_IDS,
  isCognitiveFogSymptom,
  type SymptomMatrixCategoryId,
  type SymptomMatrixPillarId,
} from "@/lib/symptom-matrix-data";
import { loadPinnedSymptomCategories } from "@/lib/symptom-matrix-settings";
import { buildSymptomLogsTodayTotalsLine } from "@/lib/symptom-matrix-report";
import {
  fetchSymptomLogsFromSupabase,
  insertSymptomLogRow,
} from "@/lib/supabase/symptom-logs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { qk } from "@/lib/query-keys";

const BTN_MIN =
  "flex min-h-[60px] items-center justify-center rounded-2xl border-4 border-black px-3 text-center text-base font-black leading-snug text-black shadow-sm transition active:scale-[0.99] disabled:opacity-50";

function tapKey(category: SymptomMatrixCategoryId, symptomName: string): string {
  return `${category}:${symptomName}`;
}

export default function SymptomMatrix() {
  const qc = useQueryClient();
  const supabaseOk = Boolean(getSupabaseBrowserClient());
  const [pinned, setPinned] = useState<SymptomMatrixPillarId[]>(() =>
    typeof window !== "undefined"
      ? loadPinnedSymptomCategories()
      : [...SYMPTOM_MATRIX_PILLAR_IDS],
  );
  const [activeCategory, setActiveCategory] =
    useState<SymptomMatrixPillarId | null>("dysautonomia");
  const [toast, setToast] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);

  const { data: symptomLogs = [] } = useQuery({
    queryKey: qk.symptomLogs,
    queryFn: () => fetchSymptomLogsFromSupabase(500),
    staleTime: 15_000,
    gcTime: 1000 * 60 * 60 * 6,
    enabled: supabaseOk,
    refetchOnWindowFocus: true,
  });

  const todayLine = useMemo(() => {
    if (!supabaseOk) return "Today: sign in to sync totals.";
    return buildSymptomLogsTodayTotalsLine(symptomLogs);
  }, [symptomLogs, supabaseOk]);

  useEffect(() => {
    const sync = () => {
      const next = loadPinnedSymptomCategories();
      setPinned(next);
      setActiveCategory((prev) =>
        prev && next.includes(prev) ? prev : next[0] ?? null,
      );
    };
    sync();
    window.addEventListener("tiaki-symptom-matrix-pinned-updated", sync);
    return () =>
      window.removeEventListener(
        "tiaki-symptom-matrix-pinned-updated",
        sync,
      );
  }, []);

  const logSymptom = useMutation({
    mutationFn: async (payload: {
      symptom_name: string;
      category: SymptomMatrixCategoryId;
    }) => {
      const res = await insertSymptomLogRow({
        symptom_name: payload.symptom_name,
        category: payload.category,
      });
      if (!res.ok) {
        throw new Error(
          res.error === "not_signed_in"
            ? "Sign in to log symptoms to your chart."
            : res.error ?? "Could not save.",
        );
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.symptomLogs });
      setToast("Logged.");
      window.setTimeout(() => setToast(null), 2200);
    },
    onError: (e: Error) => {
      setToast(e.message);
      window.setTimeout(() => setToast(null), 3800);
    },
  });

  const gridSymptoms = useMemo(() => {
    if (!activeCategory) return [];
    return SYMPTOM_MATRIX_GRID[activeCategory];
  }, [activeCategory]);

  const triggerFlash = useCallback((key: string) => {
    setFlashKey(key);
    window.setTimeout(() => {
      setFlashKey((k) => (k === key ? null : k));
    }, 650);
  }, []);

  const logTap = useCallback(
    (symptomName: string, category: SymptomMatrixCategoryId) => {
      const key = tapKey(category, symptomName);
      triggerFlash(key);
      if (!supabaseOk) {
        setToast("Connect Supabase to save symptom logs.");
        window.setTimeout(() => setToast(null), 3200);
        return;
      }
      logSymptom.mutate({ symptom_name: symptomName, category });
    },
    [logSymptom, supabaseOk, triggerFlash],
  );

  if (pinned.length === 0) {
    return (
      <section
        aria-labelledby="symptom-matrix-heading"
        className="rounded-2xl border-4 border-dashed border-slate-400 bg-slate-50 px-4 py-6"
      >
        <h2
          id="symptom-matrix-heading"
          className="text-xs font-bold uppercase tracking-[0.25em] text-slate-900"
        >
          Symptom matrix
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-700">
          No categories pinned. Choose at least one under{" "}
          <Link href="/settings" className="font-bold underline">
            Settings
          </Link>
          .
        </p>
      </section>
    );
  }

  const pendingKey =
    logSymptom.isPending && logSymptom.variables
      ? tapKey(logSymptom.variables.category, logSymptom.variables.symptom_name)
      : null;

  return (
    <section
      aria-labelledby="symptom-matrix-heading"
      className="space-y-4 rounded-2xl border-4 border-black bg-white p-4 shadow-md sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="symptom-matrix-heading"
              className="text-xs font-bold uppercase tracking-[0.25em] text-slate-900"
            >
              Symptom matrix
            </h2>
            <FeatureHelpTrigger ariaLabel="Symptom matrix help" title="Symptom matrix">
              <p>
                Priority buttons work from any category view. Pick a pillar for
                disorder-specific quick-taps; Fatigue logs under General. One tap
                saves immediately with optimistic feedback.
              </p>
            </FeatureHelpTrigger>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-600">
            One tap →{" "}
            <span className="font-semibold text-slate-900">symptom_logs</span>{" "}
            (symptom, category, time) when signed in.
          </p>
        </div>
      </div>

      {!supabaseOk && (
        <p className="rounded-xl border-2 border-amber-600 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
          Connect Supabase to save symptom taps.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={pendingKey === tapKey("dysautonomia", BLURRY_VISION_LABEL)}
          onClick={() => logTap(BLURRY_VISION_LABEL, "dysautonomia")}
          className={`${BTN_MIN} border-amber-700 bg-amber-100 text-amber-950 hover:bg-amber-200 ${
            flashKey === tapKey("dysautonomia", BLURRY_VISION_LABEL)
              ? "animate-pulse ring-4 ring-emerald-500 ring-offset-2"
              : ""
          }`}
        >
          {BLURRY_VISION_LABEL}
          <span className="sr-only"> — priority dysautonomia</span>
        </button>
        <button
          type="button"
          disabled={pendingKey === tapKey(GENERAL_CATEGORY_ID, GENERAL_FATIGUE_LABEL)}
          onClick={() => logTap(GENERAL_FATIGUE_LABEL, GENERAL_CATEGORY_ID)}
          className={`${BTN_MIN} border-slate-800 bg-slate-100 text-slate-950 hover:bg-slate-200 ${
            flashKey === tapKey(GENERAL_CATEGORY_ID, GENERAL_FATIGUE_LABEL)
              ? "animate-pulse ring-4 ring-emerald-500 ring-offset-2"
              : ""
          }`}
        >
          {GENERAL_FATIGUE_LABEL}
          <span className="sr-only"> — priority general fatigue</span>
        </button>
      </div>

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        role="tablist"
        aria-label="Symptom categories"
      >
        {pinned.map((id) => {
          const selected = activeCategory === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveCategory(id)}
              className={`min-h-[60px] rounded-2xl border-4 px-3 py-3 text-base font-black uppercase leading-tight tracking-wide transition sm:min-h-[68px] ${
                selected
                  ? "border-black bg-black text-white shadow-inner"
                  : "border-slate-700 bg-white text-slate-950 hover:bg-slate-50"
              }`}
            >
              {SYMPTOM_MATRIX_CATEGORY_LABEL[id]}
            </button>
          );
        })}
      </div>

      {activeCategory && (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          role="group"
          aria-label={`${SYMPTOM_MATRIX_CATEGORY_LABEL[activeCategory]} symptoms`}
        >
          {gridSymptoms.map((label) => {
            const key = tapKey(activeCategory, label);
            const fog = isCognitiveFogSymptom(label);
            const isFlash = flashKey === key;
            return (
              <button
                key={label}
                type="button"
                disabled={pendingKey === key}
                onClick={() => logTap(label, activeCategory)}
                className={`${BTN_MIN} ${
                  fog
                    ? "border-violet-800 bg-violet-50 text-violet-950 hover:bg-violet-100"
                    : "bg-white hover:bg-slate-50"
                } ${isFlash ? "animate-pulse ring-4 ring-emerald-500 ring-offset-2" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <p
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-800"
        aria-live="polite"
      >
        {todayLine}
      </p>

      <p className="text-center text-xs font-medium text-slate-500">
        Pin pillars on the{" "}
        <Link href="/settings" className="font-semibold text-slate-800 underline">
          Settings
        </Link>{" "}
        tab to customize your home screen.
      </p>

      {toast && (
        <p
          className="rounded-xl border-2 border-emerald-700 bg-emerald-50 px-3 py-3 text-center text-base font-bold text-emerald-950"
          role="status"
        >
          {toast}
        </p>
      )}
    </section>
  );
}
