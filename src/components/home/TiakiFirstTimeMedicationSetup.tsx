"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { qk } from "@/lib/query-keys";
import type { SavedMedication } from "@/lib/seed-medications";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import { JADE_QUICK_SETUP_MEDICATIONS } from "@/lib/quick-setup/jade-presets";
import { setMedicationsAndPersist } from "@/lib/medications-persist";

const ONBOARDING_LS = "medtracker-onboarding-complete-v2";

function readOnboardingDone(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_LS) === "1";
  } catch {
    return false;
  }
}

function writeOnboardingDone() {
  try {
    window.localStorage.setItem(ONBOARDING_LS, "1");
  } catch {
    /* ignore */
  }
}

export default function TiakiFirstTimeMedicationSetup() {
  const qc = useQueryClient();
  const { data: meds = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: fetchMedicationsQuery,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    setOnboardingDone(readOnboardingDone());
  }, []);

  const applyQuick = useMutation({
    mutationFn: async () => {
      const next: SavedMedication[] = JADE_QUICK_SETUP_MEDICATIONS.map((m) => ({
        ...m,
      }));
      setMedicationsAndPersist(qc, () => next);
      writeOnboardingDone();
      return next.length;
    },
    onSuccess: () => setOnboardingDone(true),
  });

  const skip = useMutation({
    mutationFn: async () => {
      writeOnboardingDone();
    },
    onSuccess: () => setOnboardingDone(true),
  });

  if (onboardingDone === null) return null;
  if (onboardingDone) return null;
  if (meds.length > 0) return null;

  return (
    <section
      aria-labelledby="first-setup-heading"
      className="rounded-2xl border-4 border-sky-800 bg-sky-50 p-5 shadow-md"
    >
      <h2
        id="first-setup-heading"
        className="text-2xl font-black text-slate-900"
      >
        Welcome — add your medications
      </h2>
      <p className="mt-2 text-lg font-medium text-slate-800">
        Tiaki starts with an empty list so it is safe to share. Use Quick Setup
        for Jade&apos;s saved regimen, or add meds manually below.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={applyQuick.isPending}
          onClick={() => applyQuick.mutate()}
          className="min-h-[56px] flex-1 rounded-xl border-4 border-black bg-sky-600 px-5 text-lg font-black uppercase tracking-wide text-white shadow hover:bg-sky-700 disabled:opacity-50"
        >
          Quick Setup (Jade)
        </button>
        <button
          type="button"
          disabled
          title="Camera-based import coming soon"
          className="min-h-[56px] flex-1 cursor-not-allowed rounded-xl border-4 border-slate-400 bg-slate-200 px-5 text-lg font-bold text-slate-600"
        >
          Import meds from photo (soon)
        </button>
        <button
          type="button"
          disabled={skip.isPending}
          onClick={() => skip.mutate()}
          className="min-h-[56px] flex-1 rounded-xl border-4 border-black bg-white px-5 text-lg font-bold text-slate-900 hover:bg-slate-50"
        >
          Skip — I&apos;ll add them manually
        </button>
      </div>
    </section>
  );
}
