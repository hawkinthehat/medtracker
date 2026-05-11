"use client";

import { useQuery } from "@tanstack/react-query";
import { Pill } from "lucide-react";
import { useMemo } from "react";
import { formatDoseLabel } from "@/lib/medication-profile-types";
import { getActiveMedications } from "@/lib/medication-active";
import { defaultDoseMgForMedicationName } from "@/lib/medication-dose-defaults";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import type { SavedMedication } from "@/lib/seed-medications";
import {
  getEffectiveTaperDoseMg,
  isDuringTaperSchedule,
} from "@/lib/taper-plan";
import {
  fetchMedicationProfilesFromSupabase,
  loadTaperPlansMap,
} from "@/lib/supabase/medication-history";

type Props = {
  onSelectMedication?: (med: SavedMedication) => void;
};

export default function TodayMedicationStrip({
  onSelectMedication,
}: Props) {
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

  const { data: taperPlans = {} } = useQuery({
    queryKey: qk.taperPlans,
    queryFn: loadTaperPlansMap,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    const today = new Date();
    const active = getActiveMedications(medications);
    return active.map((m) => {
      const p = profiles[m.id];
      const baseMg = p?.doseValue ?? defaultDoseMgForMedicationName(m.name);
      const unit = p?.doseUnit ?? "mg";
      const tp = taperPlans[m.id];
      let label: string;
      let sub: string | null = null;
      if (tp) {
        const eff = getEffectiveTaperDoseMg(tp, today, baseMg);
        label = `${eff} mg`;
        if (isDuringTaperSchedule(tp, today)) {
          sub = "Taper active today";
        } else {
          sub = "Taper complete — maintenance dose";
        }
      } else if (p) {
        label = formatDoseLabel(p.doseValue, p.doseUnit);
      } else if (m.doseLabel) {
        label = m.doseLabel;
        sub = null;
      } else {
        label = `${baseMg} ${unit}`;
        sub = "Default — tap medication below to customize";
      }
      const time =
        p?.scheduledTimes?.[0] ??
        (tp ? "See taper" : "—");
      return { med: m, label, sub, time };
    });
  }, [medications, profiles, taperPlans]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-slate-300/40">
      <div className="flex items-center gap-2 border-b border-slate-300 bg-slate-50/95 px-4 py-2.5">
        <Pill className="h-4 w-4 text-emerald-400" aria-hidden />
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-800">
          Today&apos;s doses
        </h2>
      </div>
      <ul className="max-h-[220px] divide-y divide-slate-800 overflow-y-auto px-4 py-2">
        {rows.map(({ med, label, sub, time }) => (
          <li key={med.id}>
            <button
              type="button"
              onClick={() => onSelectMedication?.(med)}
              disabled={!onSelectMedication}
              className={`flex w-full items-start justify-between gap-3 py-2.5 text-left text-sm transition ${
                onSelectMedication
                  ? "rounded-lg hover:bg-slate-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/80"
                  : "cursor-default"
              }`}
            >
              <div>
                <span className="font-medium text-slate-900">{med.name}</span>
                {sub && (
                  <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
                )}
              </div>
              <div className="text-right">
                <span className="text-lg font-bold tabular-nums text-slate-900">
                  {label}
                </span>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{time}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
