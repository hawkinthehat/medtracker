"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Pill } from "lucide-react";
import {
  DEFAULT_DOSE_DURATION_MIN,
  type ScheduledDose,
} from "@/lib/medication-schedule";
import { fetchMergedMedicationDoses } from "@/lib/merge-medication-doses";
import { qk } from "@/lib/query-keys";

function minuteOfDay(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

function formatHm(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function isDueInWindow(dose: ScheduledDose, nowMin: number): boolean {
  const dur = dose.durationMinutes ?? DEFAULT_DOSE_DURATION_MIN;
  const end = dose.startMinute + dur;
  return nowMin >= dose.startMinute && nowMin < end;
}

export default function DueMedicationsChecklist() {
  const qc = useQueryClient();
  const { data: doses = [], isLoading } = useQuery({
    queryKey: qk.medicationTimeline,
    queryFn: (): Promise<ScheduledDose[]> =>
      fetchMergedMedicationDoses(qc),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const due = useMemo(() => {
    const nowMin = minuteOfDay();
    return doses.filter((d) => isDueInWindow(d, nowMin));
  }, [doses]);

  return (
    <section
      aria-labelledby="due-meds-heading"
      className="rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Pill className="h-5 w-5 text-slate-900" aria-hidden />
        <h2
          id="due-meds-heading"
          className="text-base font-bold tracking-tight text-slate-900"
        >
          Due now
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Scheduled dose window for the current hour (based on your medication
        times).
      </p>

      {isLoading && (
        <p className="mt-4 text-sm text-slate-500">Loading schedule…</p>
      )}

      {!isLoading && due.length === 0 && (
        <p className="mt-4 text-sm font-medium text-slate-700">
          Nothing in your dose window right now.
        </p>
      )}

      {!isLoading && due.length > 0 && (
        <ul className="mt-4 space-y-2">
          {due.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-3"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-900 bg-white text-sm font-bold text-slate-900"
                aria-hidden
              >
                ✓
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{d.medicationName}</p>
                <p className="text-xs text-slate-600">
                  Window started {formatHm(d.startMinute)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
