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

type Props = {
  onComplete: () => void;
};

export default function WelcomeWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const Icon = s.Icon;
  const isLast = step === STEPS.length - 1;

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
      className="fixed inset-0 z-[90] flex flex-col bg-[#ffffff] p-4 shadow-[inset_0_0_0_1px_#e2e8f0]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-wizard-title"
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
        <div
          className={`rounded-3xl border-4 border-white bg-gradient-to-br p-1 shadow-2xl ${s.accent}`}
        >
          <div className="rounded-2xl border-4 border-black bg-white px-5 py-8 sm:px-8 sm:py-10">
            <div
              className="mx-auto flex h-32 w-32 items-center justify-center rounded-3xl border-4 border-black bg-slate-100 shadow-inner"
              aria-hidden
            >
              <Icon className="h-20 w-20 text-slate-900" strokeWidth={1.75} />
            </div>
            <p className="mt-4 text-center text-sm font-bold uppercase tracking-[0.2em] text-slate-600">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1
              id="welcome-wizard-title"
              className="mt-2 text-center text-3xl font-black leading-tight text-[#0f172a] sm:text-4xl"
            >
              {s.title}
            </h1>
            <p className="mt-6 text-center text-xl font-semibold leading-relaxed text-[#0f172a]">
              {s.body}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={goNext}
          className="mt-8 min-h-[72px] w-full rounded-2xl border-4 border-amber-400 bg-amber-300 py-5 text-2xl font-black uppercase tracking-wide text-slate-950 shadow-lg ring-4 ring-amber-500/50 hover:bg-amber-200"
        >
          {isLast ? "Get started" : "Next"}
        </button>
      </div>
    </div>
  );
}
