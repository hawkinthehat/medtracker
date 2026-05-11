"use client";

import SymptomCanvas from "@/components/journal/SymptomCanvas";

export default function JournalPainTracker() {
  return (
    <section
      aria-labelledby="journal-pain-heading"
      className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm ring-1 ring-slate-200/90"
    >
      <div className="space-y-1">
        <h2
          id="journal-pain-heading"
          className="text-sm font-bold uppercase tracking-[0.2em] text-sky-800"
        >
          Symptom sketch map
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Trace burning, aching, or rash patterns on the clinical outline —
          clearer than tapping regions alone. After each circle, add a quick
          note; or save the whole map with the button at the bottom. Draw on{" "}
          <span className="font-medium text-slate-800">front</span> and{" "}
          <span className="font-medium text-slate-800">back</span> as needed.
          Syncs to{" "}
          <code className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
            daily_logs
          </code>
          .
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Front
          </span>
          <SymptomCanvas side="front" className="w-full" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Back
          </span>
          <SymptomCanvas side="back" className="w-full" />
        </div>
      </div>
    </section>
  );
}
