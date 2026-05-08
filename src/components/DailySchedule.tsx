"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  assignDoseLanes,
  buildFallbackScheduleFromSeed,
  computeBloodPressureClusterZones,
  computeFluconazoleWindows,
  fetchScheduledDosesFromSupabase,
  isBloodPressureLoweringName,
  isFluconazoleName,
  isGleevecOrLatudaName,
  substrateDosesWithInhibitorGlow,
  type ScheduledDose,
} from "@/lib/medication-schedule";

function minuteToPct(m: number): number {
  return (m / (24 * 60)) * 100;
}

function formatHourTick(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ampm}`;
}

export default function DailySchedule() {
  const { data: doses = [], isFetching } = useQuery({
    queryKey: qk.medicationTimeline,
    queryFn: async (): Promise<ScheduledDose[]> => {
      const remote = await fetchScheduledDosesFromSupabase();
      if (remote.length > 0) return remote;
      return buildFallbackScheduleFromSeed();
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24 * 7,
  });

  const redZones = useMemo(
    () => computeBloodPressureClusterZones(doses),
    [doses]
  );

  const inhibitorWindows = useMemo(
    () => computeFluconazoleWindows(doses),
    [doses]
  );

  const glowIds = useMemo(
    () => substrateDosesWithInhibitorGlow(doses, inhibitorWindows),
    [doses, inhibitorWindows]
  );

  const hasFluconazole = useMemo(
    () => doses.some((d) => isFluconazoleName(d.medicationName)),
    [doses]
  );

  const lanes = useMemo(() => assignDoseLanes(doses), [doses]);
  const laneCount = useMemo(() => {
    let m = 0;
    lanes.forEach((v) => {
      m = Math.max(m, v + 1);
    });
    return Math.max(m, 1);
  }, [lanes]);

  return (
    <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Daily schedule (24h)
          </h2>
          <p className="mt-1 max-w-prose text-sm text-slate-400">
            Pulled from Supabase when{" "}
            <code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-sky-200">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            is set; otherwise demo times from your med list. Yellow bands: two
            different BP-lowering meds within 2h. Red glow: Gleevec / Latuda
            during modeled Fluconazole inhibition.
          </p>
        </div>
        {isFetching && (
          <span className="text-xs font-medium text-slate-500">Updating…</span>
        )}
      </div>

      <div className="relative mt-6">
        <div
          className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100/90"
          style={{ height: `${96 + laneCount * 40}px` }}
        >
          {/* Hour grid */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="flex-1 border-l border-slate-200 first:border-l-0"
                title={formatHourTick(h)}
              />
            ))}
          </div>

          {/* Red zone (BP clusters) */}
          {redZones.map((z, i) => (
            <div
              key={`rz-${i}`}
              className="absolute bottom-0 top-0 bg-yellow-400/25"
              style={{
                left: `${minuteToPct(z.start)}%`,
                width: `${minuteToPct(z.end - z.start)}%`,
              }}
            />
          ))}

          {/* Fluconazole inhibitor wash (subtle) */}
          {inhibitorWindows.map((w, i) => (
            <div
              key={`inh-${i}`}
              className="pointer-events-none absolute bottom-0 top-0 bg-violet-500/10"
              style={{
                left: `${minuteToPct(w.start)}%`,
                width: `${minuteToPct(w.end - w.start)}%`,
              }}
            />
          ))}

          {/* Dose bars */}
          <div className="absolute inset-x-0 bottom-8 top-3 px-0">
            {doses.map((d) => {
              const left = minuteToPct(d.startMinute);
              const width = Math.max(
                minuteToPct(d.durationMinutes),
                0.8
              );
              const lane = lanes.get(d.id) ?? 0;
              const bp = isBloodPressureLoweringName(d.medicationName);
              const flu = isFluconazoleName(d.medicationName);
              const subGlow = glowIds.has(d.id);
              const base =
                "absolute flex h-9 max-h-10 items-center justify-center rounded-md px-1 text-center text-[10px] font-semibold leading-tight text-white shadow-sm sm:text-xs";
              let bg = "bg-slate-600";
              if (flu) bg = "bg-violet-600";
              else if (bp) bg = "bg-rose-700";
              else if (isGleevecOrLatudaName(d.medicationName))
                bg = "bg-emerald-700";

              return (
                <div
                  key={d.id}
                  className={`${base} ${bg} ${
                    subGlow
                      ? "ring-2 ring-red-500 ring-offset-2 ring-offset-white [box-shadow:0_0_18px_rgba(239,68,68,0.85)]"
                      : ""
                  }`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    maxWidth: "100%",
                    top: `${12 + lane * 36}px`,
                  }}
                  title={`${d.medicationName} · ${Math.floor(d.startMinute / 60)
                    .toString()
                    .padStart(2, "0")}:${(d.startMinute % 60)
                    .toString()
                    .padStart(2, "0")}`}
                >
                  <span className="line-clamp-2 select-none">
                    {d.medicationName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-1 flex justify-between text-[10px] text-slate-500 sm:text-xs">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>12 AM</span>
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-xs text-slate-400">
        <li>
          <span className="font-medium text-yellow-200/90">Yellow band: </span>
          two or more of Duloxetine, Trazodone, Lorazepam scheduled within 2
          hours (distinct meds).
        </li>
        <li>
          <span className="font-medium text-red-300">Red glow: </span>
          Gleevec or Latuda during Fluconazole inhibition windows
          {hasFluconazole ? "" : " (add Fluconazole to see this interaction)"}.
        </li>
      </ul>
    </section>
  );
}
