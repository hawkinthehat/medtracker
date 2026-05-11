"use client";

import { Info } from "lucide-react";
import { useEffect, useState } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

/** Full-screen dimmed overlay with high-contrast copy and a single dismiss action. */
export function FeatureHelpModal({
  open,
  onClose,
  title,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-help-title"
    >
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl border-4 border-black bg-white p-6 shadow-2xl">
        <h3
          id="feature-help-title"
          className="text-2xl font-black leading-tight text-[#0f172a]"
        >
          {title}
        </h3>
        <div className="mt-4 space-y-4 text-[18px] font-semibold leading-snug text-[#0f172a] [&_p]:text-[18px] [&_li]:text-[18px]">
          {children}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-8 min-h-[56px] w-full rounded-2xl border-4 border-black bg-sky-600 py-4 text-xl font-black uppercase tracking-wide text-white shadow-lg hover:bg-sky-700"
        >
          Got it!
        </button>
      </div>
    </div>
  );
}

type TriggerProps = {
  /** Accessible name, e.g. "Barometric pressure help" */
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
};

/** Large (i) control that opens a help modal. */
export function FeatureHelpTrigger({ ariaLabel, title, children }: TriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[3px] border-slate-900 bg-amber-300 text-slate-950 shadow-md transition hover:bg-amber-200 focus-visible:outline focus-visible:ring-4 focus-visible:ring-sky-500 sm:h-12 sm:w-12 sm:rounded-2xl sm:border-4"
        aria-label={ariaLabel}
      >
        <Info
          className="h-6 w-6 sm:h-8 sm:w-8"
          strokeWidth={2.5}
          aria-hidden
        />
      </button>
      <FeatureHelpModal open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </FeatureHelpModal>
    </>
  );
}
