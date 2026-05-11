"use client";

import type { RecentDoseContext } from "@/lib/recent-dose-context";
import { formatRoughHoursAgo } from "@/lib/recent-dose-context";

type Props = {
  open: boolean;
  candidate: RecentDoseContext | null;
  onDismiss: () => void;
  onConfirmYes: () => void;
};

export default function ContextualSideEffect({
  open,
  candidate,
  onDismiss,
  onConfirmYes,
}: Props) {
  if (!open || !candidate) return null;

  return (
    <div
      className="mt-4 rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-4 ring-1 ring-amber-900/40"
      role="dialog"
      aria-labelledby="ctx-side-effect-title"
    >
      <p
        id="ctx-side-effect-title"
        className="text-sm font-semibold leading-snug text-amber-50"
      >
        You took{" "}
        <span className="text-amber-200">{candidate.medicationName}</span> about{" "}
        {formatRoughHoursAgo(candidate.hoursAgo)} ago. Could this be a reaction?
      </p>
      <p className="mt-2 text-xs leading-relaxed text-amber-200/85">
        This mood dip might be medication-related.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirmYes}
          className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          Yes, link side effect
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-800"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
