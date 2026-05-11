"use client";

import { useState } from "react";
import { Activity, Cloud, LayoutGrid } from "lucide-react";
import { markWelcomeWizardComplete } from "@/lib/baselines-storage";

const STEPS = [
  {
    id: "weather",
    title: "Barometric tracking",
    Icon: Cloud,
    accent: "from-sky-500 to-indigo-700",
    body:
      "Air pressure shifts change how blood vessels tighten or relax. Many people with dysautonomia feel worse when pressure drops quickly — Tiaki watches local pressure so you can plan hydration and rest before symptoms spike.",
  },
  {
    id: "stand",
    title: "Active stand test",
    Icon: Activity,
    accent: "from-emerald-500 to-teal-800",
    body:
      "This is the practical gold standard for spotting orthostatic hypotension (OH) and many POTS patterns: compare lying versus standing BP and heart rate so your clinician can see how gravity stresses your circulation.",
  },
  {
    id: "dashboard",
    title: "One-tap dashboard",
    Icon: LayoutGrid,
    accent: "from-violet-500 to-fuchsia-800",
    body:
      "Large buttons and plain language are intentional — when brain fog or dizziness hits, you should still be able to log meds, fluids, and movement in seconds.",
  },
] as const;

/** Sticky action bar pinned under scrollable onboarding copy — matches dashboard step cards. */
const ACTION_BAR =
  "sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]";

type Props = {
  onComplete: () => void;
};

export default function WelcomeWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const Icon = s.Icon;
  const isLast = step === STEPS.length - 1;

  /** Tighter chrome on small screens for barometric + active-stand slides */
  const denseMobile = s.id === "weather" || s.id === "stand";

  function skipToDashboard() {
    markWelcomeWizardComplete();
    onComplete();
  }

  function goNext() {
    if (isLast) {
      markWelcomeWizardComplete();
      onComplete();
      return;
    }
    setStep((x) => x + 1);
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-[#ffffff] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-[inset_0_0_0_1px_#e2e8f0]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-wizard-title"
    >
      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-slate-100 bg-white/95 px-3 py-2 backdrop-blur-sm">
        <button
          type="button"
          onClick={skipToDashboard}
          className="min-h-[44px] rounded-lg border-2 border-slate-900 bg-white px-4 py-2 text-sm font-black uppercase tracking-wide text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:ring-4 focus-visible:ring-sky-500"
        >
          Skip to Dashboard
        </button>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center px-4 py-2 pb-[max(6rem,calc(5.5rem+env(safe-area-inset-bottom)))]">
        <div
          className={`mx-auto flex w-full max-h-[75vh] min-h-0 flex-col overflow-hidden rounded-3xl border-4 border-white bg-gradient-to-br p-1 shadow-2xl ${s.accent}`}
        >
          <div className="relative flex max-h-[75vh] min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-4 border-black bg-white">
            <div
              className={`max-h-[75vh] min-h-0 flex-1 overflow-y-auto overscroll-contain ${
                denseMobile ? "px-4 py-4 sm:px-8 sm:py-10" : "px-5 py-6 sm:px-8 sm:py-10"
              }`}
            >
              <div
                className={`mx-auto flex items-center justify-center rounded-3xl border-4 border-black bg-slate-100 shadow-inner ${
                  denseMobile
                    ? "h-[4.75rem] w-[4.75rem] sm:h-32 sm:w-32"
                    : "h-28 w-28 sm:h-32 sm:w-32"
                }`}
                aria-hidden
              >
                <Icon
                  className={
                    denseMobile
                      ? "h-11 w-11 text-slate-900 sm:h-20 sm:w-20"
                      : "h-14 w-14 text-slate-900 sm:h-20 sm:w-20"
                  }
                  strokeWidth={1.75}
                />
              </div>
              <p
                className={`mt-3 text-center font-bold uppercase tracking-[0.2em] text-slate-600 sm:mt-4 ${
                  denseMobile ? "text-xs sm:text-sm" : "text-sm"
                }`}
              >
                Step {step + 1} of {STEPS.length}
              </p>
              <h1
                id="welcome-wizard-title"
                className={`mt-2 text-center font-black leading-tight text-[#0f172a] ${
                  denseMobile
                    ? "text-xl sm:text-4xl sm:leading-tight"
                    : "text-3xl sm:text-4xl"
                }`}
              >
                {s.title}
              </h1>
              <p
                className={`mt-4 text-center font-semibold leading-relaxed text-[#0f172a] sm:mt-6 ${
                  denseMobile
                    ? "text-base leading-snug sm:text-xl sm:leading-relaxed"
                    : "text-xl"
                }`}
              >
                {s.body}
              </p>
            </div>

            <div className={ACTION_BAR}>
              <button
                type="button"
                onClick={goNext}
                className="min-h-[60px] w-full rounded-2xl border-4 border-amber-400 bg-amber-300 py-4 text-xl font-black uppercase tracking-wide text-slate-950 shadow-lg ring-4 ring-amber-500/50 hover:bg-amber-200 sm:min-h-[72px] sm:py-5 sm:text-2xl"
              >
                {isLast ? "Get started" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
