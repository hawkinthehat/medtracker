"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { qk } from "@/lib/query-keys";
import {
  EMERGENCY_CONTACTS,
  EMERGENCY_LEGAL_NAME,
} from "@/lib/emergency-identity";
import {
  SEED_SAVED_MEDICATIONS,
  type SavedMedication,
} from "@/lib/seed-medications";

const CORE_DIAGNOSES = [
  "Orthostatic Hypotension",
  "MCAS",
  "Sjögren's",
  "MVP",
] as const;

export default function EmergencyMedicalIdPage() {
  const { data: medications = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: async (): Promise<SavedMedication[]> => SEED_SAVED_MEDICATIONS,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  return (
    <div
      id="emergency-print-root"
      className="print-emergency-root -mx-4 -mt-6 min-h-[calc(100dvh-5rem)] rounded-none border-0 bg-red-700 px-4 pb-16 pt-6 text-white shadow-none ring-0 sm:-mx-5 sm:px-5 print:mx-0 print:mt-0 print:min-h-0 print:bg-white print:p-6 print:text-neutral-900"
    >
      <div className="mx-auto max-w-xl space-y-5 print:max-w-none">
        <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
          <Link
            href="/"
            className="text-sm font-semibold text-white/90 underline-offset-4 hover:text-white hover:underline"
          >
            ← Planner
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-white bg-white px-4 py-2 text-sm font-bold uppercase tracking-wide text-red-700 shadow-sm hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Print this page
          </button>
        </div>

        <header className="border-b-4 border-white pb-4 print:border-neutral-300">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-100 print:text-neutral-500">
            Emergency medical identification
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white print:text-neutral-900">
            {EMERGENCY_LEGAL_NAME}
          </h1>
        </header>

        <div className="rounded-md border-4 border-black bg-yellow-300 px-4 py-3 text-center shadow-sm print:border-neutral-900">
          <p className="text-sm font-black uppercase leading-snug tracking-wide text-black sm:text-base">
            METABOLIC SENSITIVITY: Do not administer CYP3A4 inhibitors.
          </p>
        </div>

        <section className="rounded-xl border-2 border-white/40 bg-red-800/50 p-4 print:border-neutral-400 print:bg-white">
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-red-100 print:text-neutral-600">
            Emergency contacts
          </h2>
          <ul className="mt-3 space-y-3">
            {EMERGENCY_CONTACTS.map((c) => (
              <li
                key={`${c.relationship}-${c.phone}`}
                className="border-b border-white/20 pb-3 last:border-0 last:pb-0 print:border-neutral-200"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-red-200 print:text-neutral-500">
                  {c.relationship}
                </p>
                <p className="text-lg font-bold text-white print:text-neutral-900">
                  {c.name}
                </p>
                <a
                  href={`tel:${c.phone.replace(/\D/g, "")}`}
                  className="mt-0.5 inline-block font-mono text-base text-white underline decoration-white/60 print:text-neutral-900 print:decoration-neutral-400"
                >
                  {c.phone}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border-2 border-white/40 bg-red-800/50 p-4 print:border-neutral-400 print:bg-white">
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-red-100 print:text-neutral-600">
            Core diagnoses
          </h2>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-base font-semibold leading-relaxed text-white marker:text-white print:text-neutral-900 print:marker:text-neutral-900">
            {CORE_DIAGNOSES.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border-2 border-white/40 bg-red-800/50 p-4 print:border-neutral-400 print:bg-white">
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-red-100 print:text-neutral-600">
            Current medications
          </h2>
          {medications.length === 0 ? (
            <p className="mt-2 text-sm text-red-100 print:text-neutral-600">
              No medications on file.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {medications.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/15 pb-2 text-base font-semibold text-white last:border-0 print:border-neutral-200 print:text-neutral-900"
                >
                  <span>{m.name}</span>
                  {m.pathway_role ? (
                    <span className="font-mono text-xs font-normal text-red-100 print:text-neutral-600">
                      {m.pathway_role}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-[10px] font-medium text-red-200/90 print:text-neutral-500">
          Source: MedTracker · Update contacts and name in the app when they
          change.
        </p>
      </div>
    </div>
  );
}
