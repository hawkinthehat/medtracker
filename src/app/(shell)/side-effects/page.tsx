"use client";

import SideEffectAuditor from "@/components/SideEffectAuditor";

export default function SideEffectsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Side Effect Tracker
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-slate-400">
          Log how you feel and cross-check against your medication list. Rules
          highlight overlapping risks when multiple sedating or interacting meds
          cluster on your schedule.
        </p>
      </header>

      <SideEffectAuditor />
    </div>
  );
}
