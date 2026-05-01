"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type {
  JournalEntry,
  OrthostaticSession,
  SpecialistFacility,
  SpecialistNote,
  VitalRow,
} from "@/lib/types";
import { generateThirtyDayMedicalPdf } from "@/lib/pdf-export";
import ClinicalSummaryCard from "@/components/ClinicalSummaryCard";
import DrugTolerabilityReport from "@/components/DrugTolerabilityReport";
import TaperSensitivitySection from "@/components/TaperSensitivitySection";
import { useState } from "react";

export default function TransferPage() {
  const qc = useQueryClient();
  const { data: notes = [] } = useQuery({
    queryKey: qk.specialistNotes,
    queryFn: async (): Promise<SpecialistNote[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: vitals = [] } = useQuery<VitalRow[]>({
    queryKey: qk.vitals,
    queryFn: async () => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: orthostatic = [] } = useQuery<OrthostaticSession[]>({
    queryKey: qk.orthostatic,
    queryFn: async () => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: journal = [] } = useQuery<JournalEntry[]>({
    queryKey: qk.journal,
    queryFn: async () => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const [facility, setFacility] = useState<SpecialistFacility>(
    "KU Medical Center"
  );
  const [specialist, setSpecialist] = useState("");
  const [body, setBody] = useState("");
  const [exporting, setExporting] = useState(false);

  const addNote = useMutation({
    mutationFn: async (n: SpecialistNote) => n,
    onSuccess: (row) => {
      qc.setQueryData<SpecialistNote[]>(qk.specialistNotes, (prev = []) => [
        row,
        ...prev,
      ]);
      setSpecialist("");
      setBody("");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = body.trim();
    if (!t) return;
    addNote.mutate({
      id: crypto.randomUUID(),
      facility,
      specialist: specialist.trim(),
      recordedAt: new Date().toISOString(),
      notes: t,
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      await generateThirtyDayMedicalPdf({
        vitals,
        orthostatic,
        journal,
      });
    } finally {
      setExporting(false);
    }
  }

  const ku = notes.filter((n) => n.facility === "KU Medical Center");
  const washu = notes.filter((n) => n.facility === "WashU");

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Transfer & specialists
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Notes for{" "}
            <span className="text-slate-200">KU Medical Center</span> and{" "}
            <span className="text-slate-200">WashU</span>, plus a PDF packet for
            appointments.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="w-full rounded-xl border border-sky-500/40 bg-sky-950/40 py-3 text-sm font-semibold text-sky-200 hover:bg-sky-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50"
        >
          {exporting ? "Building PDF…" : "Generate 30-day export"}
        </button>
      </header>

      <DrugTolerabilityReport />

      <TaperSensitivitySection />

      <ClinicalSummaryCard />

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 ring-1 ring-white/5"
      >
        <div>
          <label
            htmlFor="facility"
            className="text-sm font-medium text-slate-200"
          >
            Site
          </label>
          <select
            id="facility"
            className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-base text-slate-50"
            value={facility}
            onChange={(e) =>
              setFacility(e.target.value as SpecialistFacility)
            }
          >
            <option>KU Medical Center</option>
            <option>WashU</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="specialist"
            className="text-sm font-medium text-slate-200"
          >
            Specialist / clinic (optional)
          </label>
          <input
            id="specialist"
            className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-slate-50"
            value={specialist}
            onChange={(e) => setSpecialist(e.target.value)}
            placeholder="Name or department"
          />
        </div>
        <div>
          <label htmlFor="note-body" className="text-sm font-medium text-slate-200">
            Notes for next visit
          </label>
          <textarea
            id="note-body"
            rows={4}
            className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-slate-50"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Questions, medication changes, imaging follow-ups…"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-slate-700 py-3 text-sm font-semibold text-white hover:bg-slate-600"
          disabled={!body.trim()}
        >
          Save note
        </button>
      </form>

      <SiteSection title="KU Medical Center" items={ku} />
      <SiteSection title="WashU" items={washu} />
    </div>
  );
}

function SiteSection({
  title,
  items,
}: {
  title: string;
  items: SpecialistNote[];
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      <ul className="mt-3 space-y-3">
        {items.length === 0 && (
          <li className="text-sm text-slate-500">No notes yet.</li>
        )}
        {items.map((n) => (
          <li
            key={n.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <time
                className="text-xs text-slate-500"
                dateTime={n.recordedAt}
              >
                {new Date(n.recordedAt).toLocaleString()}
              </time>
              {n.specialist && (
                <span className="text-xs font-medium text-sky-300">
                  {n.specialist}
                </span>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
              {n.notes}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
