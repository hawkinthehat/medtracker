"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { MedicationProfile } from "@/lib/medication-profile-types";
import { qk } from "@/lib/query-keys";
import {
  QUICK_RELIEF_DEFS,
  buildQuickReliefPainLinkSummary,
  clockPeriod,
  findSavedMedForQuickRelief,
  isSymptomBodyPartId,
  resolveQuickReliefDosageLabel,
  type QuickReliefDef,
} from "@/lib/quick-relief";
import type { PainMapSymptomCategory } from "@/lib/symptom-map";
import type { SavedMedication } from "@/lib/seed-medications";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import { fetchMedicationProfilesFromSupabase } from "@/lib/supabase/medication-history";
import {
  fetchMedicationLogsFromSupabase,
  insertMedicationLogRow,
  type MedicationLogRow,
} from "@/lib/supabase/medication-logs";
import { fetchMostRecentPainMapTouchSince } from "@/lib/pain-map-db";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { FeatureHelpTrigger } from "@/components/FeatureHelpModal";
import { toastPrnLogged } from "@/lib/educational-toasts";

const FOUR_H_MS = 4 * 60 * 60 * 1000;
const THIRTY_MIN_MS = 30 * 60 * 1000;

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function QuickRelief() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const supabaseOk = Boolean(getSupabaseBrowserClient());

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

  const { data: logs = [] } = useQuery({
    queryKey: qk.medicationLogs,
    queryFn: () => fetchMedicationLogsFromSupabase(250),
    staleTime: 15_000,
    gcTime: 1000 * 60 * 60 * 24 * 7,
    refetchOnWindowFocus: true,
  });

  const lastByDef = useMemo(() => {
    const map = new Map<string, MedicationLogRow>();
    for (const def of QUICK_RELIEF_DEFS) {
      const hit = logs.find((l) => l.medicationName === def.displayName);
      if (hit) map.set(def.displayName, hit);
    }
    return map;
  }, [logs]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!errorToast) return;
    const t = window.setTimeout(() => setErrorToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [errorToast]);

  const logMutation = useMutation({
    mutationFn: async (def: QuickReliefDef) => {
      if (!getSupabaseBrowserClient()) {
        throw new Error(
          "Connect Supabase in your environment to save PRN logs to your chart.",
        );
      }
      const meds =
        qc.getQueryData<SavedMedication[]>(qk.medications) ?? medications;
      const profs =
        qc.getQueryData<Record<string, MedicationProfile>>(
          qk.medicationProfiles,
        ) ?? profiles;

      const dosageLabel = resolveQuickReliefDosageLabel(def, meds, profs);
      const medMatch = findSavedMedForQuickRelief(def, meds);
      const sinceIso = new Date(Date.now() - THIRTY_MIN_MS).toISOString();
      const touch = await fetchMostRecentPainMapTouchSince(sinceIso);

      let linkSummary: string | null = null;
      let linkedBodyPartId: string | null = null;
      let linkedPainCategory: string | null = null;
      let linkedPainIntensity: number | null = null;

      if (touch && isSymptomBodyPartId(touch.body_part_id)) {
        const cat = touch.category as PainMapSymptomCategory;
        linkedBodyPartId = touch.body_part_id;
        linkedPainCategory = cat;
        linkedPainIntensity =
          touch.intensity != null && Number.isFinite(Number(touch.intensity))
            ? Math.round(Number(touch.intensity))
            : null;
        linkSummary = buildQuickReliefPainLinkSummary(
          def.displayName,
          touch.body_part_id,
          cat,
          touch.intensity,
        );
      }

      const res = await insertMedicationLogRow({
        medicationName: def.displayName,
        dosageLabel,
        period: clockPeriod(),
        medicationId: medMatch?.id ?? null,
        linkedBodyPartId,
        linkedPainCategory,
        linkedPainIntensity,
        linkSummary,
      });

      if (!res.ok) {
        throw new Error(res.error ?? "Could not save log.");
      }
      return { row: res.row!, def };
    },
    onSuccess: ({ row, def }) => {
      qc.setQueryData<MedicationLogRow[]>(qk.medicationLogs, (prev = []) => {
        const next = [row, ...prev.filter((x) => x.id !== row.id)];
        return next;
      });
      void qc.invalidateQueries({ queryKey: qk.medicationLogs });
      const t = formatClock(row.recordedAt);
      setToast(toastPrnLogged(def.displayName, t));
    },
    onError: (e) => {
      const msg =
        e instanceof Error ? e.message : "Could not log. Check Supabase.";
      console.error("[quick-relief] log failed:", e);
      setErrorToast(msg);
    },
  });

  return (
    <section
      aria-labelledby="quick-relief-heading"
      className="space-y-3 border-b-2 border-slate-200 pb-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="quick-relief-heading"
              className="text-xs font-bold uppercase tracking-[0.25em] text-slate-900"
            >
              Quick relief
            </h2>
            <FeatureHelpTrigger
              ariaLabel="Quick relief help"
              title="Quick relief"
            >
              <p>
                One-tap logging for PRN meds when you&apos;re dizzy or foggy.
                When you&apos;re signed in, each tap is saved to your chart for
                your doctor report.
              </p>
            </FeatureHelpTrigger>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-600">
            One tap logs the dose from your med list when it matches. Still
            tappable if your doctor said to override spacing. When you are
            signed in, each tap is stored in your{" "}
            <span className="font-semibold text-slate-800">medication_logs</span>{" "}
            table for your doctor report.
          </p>
        </div>
      </div>

      {!supabaseOk && (
        <p className="rounded-xl border-2 border-amber-600 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
          Connect Supabase to save PRN logs to your chart.
        </p>
      )}

      <div className="-mx-1 flex gap-3 overflow-x-auto pb-1 pt-1 [scrollbar-width:thin]">
        {QUICK_RELIEF_DEFS.map((def) => {
          const last = lastByDef.get(def.displayName);
          const lastLabel = last ? formatClock(last.recordedAt) : null;
          const within4h = last
            ? Date.now() - new Date(last.recordedAt).getTime() < FOUR_H_MS
            : false;
          const waitStyle = within4h;
          return (
            <button
              key={def.displayName}
              type="button"
              disabled={logMutation.isPending}
              onClick={() => logMutation.mutate(def)}
              className={`flex min-h-[120px] w-[min(46vw,11rem)] shrink-0 snap-start flex-col justify-between rounded-2xl border-4 border-black px-3 py-3 text-left shadow-md transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                waitStyle
                  ? "bg-slate-200 ring-2 ring-slate-400"
                  : `bg-gradient-to-br ${def.gradientClass} ring-2 ${def.ringClass} text-white`
              }`}
              aria-label={`Log ${def.displayName}`}
            >
              <span
                className={`text-lg font-black leading-tight ${
                  waitStyle ? "text-slate-900" : "text-white drop-shadow-sm"
                }`}
              >
                {def.displayName}
              </span>
              <span
                className={`mt-2 text-xs font-bold ${
                  waitStyle ? "text-slate-700" : "text-white/95"
                }`}
              >
                {lastLabel ? `Last: ${lastLabel}` : "Last: —"}
              </span>
              {waitStyle && (
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  Wait · under 4h
                </span>
              )}
            </button>
          );
        })}
      </div>

      {toast && (
        <div
          className="fixed bottom-6 left-4 right-4 z-[90] rounded-2xl border-4 border-emerald-900 bg-emerald-50 px-5 py-5 text-center text-[18px] font-semibold leading-snug text-[#0f172a] shadow-2xl sm:left-auto sm:right-auto sm:mx-auto sm:max-w-lg"
          role="status"
        >
          {toast}
        </div>
      )}

      {errorToast && (
        <div
          className="fixed bottom-6 left-4 right-4 z-[90] rounded-2xl border-4 border-slate-600 bg-slate-50 px-5 py-4 text-center text-lg font-semibold text-slate-900 shadow-2xl sm:mx-auto sm:max-w-lg"
          role="status"
        >
          {errorToast}
        </div>
      )}
    </section>
  );
}
