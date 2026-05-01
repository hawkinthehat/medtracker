"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { qk } from "@/lib/query-keys";
import type { TaperSensitivityEvent } from "@/lib/medication-profile-types";

export default function TaperSensitivitySection() {
  const { data: events = [] } = useQuery({
    queryKey: qk.taperSensitivityEvents,
    queryFn: async (): Promise<TaperSensitivityEvent[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  if (events.length === 0) return null;

  return (
    <section className="rounded-2xl border border-rose-800/50 bg-rose-950/25 p-4 ring-1 ring-rose-900/40">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-rose-400" aria-hidden />
        <h2 className="text-lg font-semibold text-rose-100">
          Taper sensitivity (Missouri transfer)
        </h2>
      </div>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-rose-200/85">
        Crisis mood or severe brain fog logged while a taper was active — worth
        reviewing with your Missouri specialists.
      </p>
      <ul className="mt-4 space-y-3">
        {events.map((e) => (
          <li
            key={e.id}
            className="rounded-xl border border-rose-900/40 bg-rose-950/40 px-4 py-3"
          >
            <time
              className="text-xs text-rose-300/80"
              dateTime={e.recordedAt}
            >
              {new Date(e.recordedAt).toLocaleString()}
            </time>
            <p className="mt-1 text-sm font-medium text-rose-50">
              {e.kind === "mood_crisis" ? "Crisis mood" : "Severe brain fog"}
              {e.medicationNamesInTaper.length > 0 && (
                <span className="font-normal text-rose-200/90">
                  {" "}
                  · Tapers: {e.medicationNamesInTaper.join(", ")}
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-rose-200/70">{e.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
