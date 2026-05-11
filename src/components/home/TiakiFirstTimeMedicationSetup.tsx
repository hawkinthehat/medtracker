"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Link from "next/link";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";

const ONBOARDING_LS = "medtracker-onboarding-complete-v2";
const CLIMATE_LS = "tiaki-tracking-climate-v1";
const DISPLAY_NAME_LS = "tiaki-display-name";

const CLIMATE_OPTIONS = [
  "Humid subtropical / summer heat",
  "Dry / continental",
  "Maritime or cool temperate",
  "High altitude",
  "Tropical",
  "Other or prefer not to say",
] as const;

const CAROUSEL_SHELL =
  "flex h-[min(75vh,calc(100dvh-10rem))] max-h-[75vh] w-[min(92vw,380px)] shrink-0 snap-start flex-col overflow-hidden rounded-xl border-2 border-sky-800 bg-sky-50 shadow-md";

const CAROUSEL_SCROLL =
  "max-h-[75vh] min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3";

const FIRST_TIME_ACTION_BAR =
  "sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-2";

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

function useTiakiFirstTimeSetup() {
  const { data: meds = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: fetchMedicationsQuery,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [climate, setClimate] = useState<string>(CLIMATE_OPTIONS[0]);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    setOnboardingDone(readOnboardingDone());
    try {
      const c = window.localStorage.getItem(CLIMATE_LS)?.trim();
      if (c) setClimate(c);
      const n = window.localStorage.getItem(DISPLAY_NAME_LS)?.trim();
      if (n) setDisplayName(n);
    } catch {
      /* ignore */
    }
  }, []);

  const finish = useMutation({
    mutationFn: async () => {
      try {
        window.localStorage.setItem(CLIMATE_LS, climate.trim());
        const dn = displayName.trim();
        if (dn) window.localStorage.setItem(DISPLAY_NAME_LS, dn);
        else window.localStorage.removeItem(DISPLAY_NAME_LS);
      } catch {
        /* ignore */
      }
      writeOnboardingDone();
    },
    onSuccess: () => setOnboardingDone(true),
  });

  const visible =
    onboardingDone !== null && !onboardingDone && meds.length === 0;

  return {
    visible,
    climate,
    setClimate,
    displayName,
    setDisplayName,
    finish,
  };
}

/** Compact welcome slide for the home dashboard horizontal carousel. */
export function TiakiFirstTimeCarouselSlide() {
  const { visible, climate, setClimate, displayName, setDisplayName, finish } =
    useTiakiFirstTimeSetup();

  if (!visible) return null;

  return (
    <section
      aria-labelledby="first-setup-carousel-heading"
      className={CAROUSEL_SHELL}
    >
      <div className={CAROUSEL_SCROLL}>
        <p className="text-[11px] font-black uppercase tracking-widest text-sky-950">
          Welcome
        </p>
        <h2
          id="first-setup-carousel-heading"
          className="mt-1 text-lg font-black leading-tight text-slate-900"
        >
          Set up Tiaki
        </h2>
        <p className="mt-2 text-xs font-medium leading-snug text-slate-800">
          Region helps interpret weather patterns (device-only).
        </p>

        <label className="mt-2 block text-xs font-bold text-slate-900">
          Region / climate
          <select
            className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-black bg-white px-2 text-sm font-semibold text-slate-900"
            value={climate}
            onChange={(e) => setClimate(e.target.value)}
          >
            {CLIMATE_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-2 block text-xs font-bold text-slate-900">
          What should we call you?{" "}
          <span className="font-normal text-slate-600">(optional)</span>
          <input
            className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-black bg-white px-2 text-sm font-semibold text-slate-900"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="First name or nickname"
            autoComplete="nickname"
          />
        </label>
      </div>

      <div className={FIRST_TIME_ACTION_BAR}>
        <button
          type="button"
          disabled={finish.isPending}
          onClick={() => finish.mutate()}
          className="min-h-[48px] w-full rounded-xl border-2 border-black bg-sky-600 px-3 text-sm font-black uppercase tracking-wide text-white shadow hover:bg-sky-700 disabled:opacity-50"
        >
          Save &amp; continue
        </button>
        <Link
          href="/meds"
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-black bg-white px-3 text-sm font-black uppercase tracking-wide text-slate-900 shadow hover:bg-slate-50"
        >
          Open medications
        </Link>
      </div>
    </section>
  );
}

export default function TiakiFirstTimeMedicationSetup() {
  const { visible, climate, setClimate, displayName, setDisplayName, finish } =
    useTiakiFirstTimeSetup();

  if (!visible) return null;

  return (
    <section
      aria-labelledby="first-setup-heading"
      className="rounded-2xl border-4 border-sky-800 bg-sky-50 p-5 shadow-md"
    >
      <h2
        id="first-setup-heading"
        className="text-2xl font-black text-slate-900"
      >
        Welcome — set up Tiaki
      </h2>
      <p className="mt-2 text-lg font-medium text-slate-800">
        Which region or climate are you tracking? This helps interpret weather
        and symptom patterns (stored only on this device).
      </p>

      <label className="mt-5 block text-lg font-bold text-slate-900">
        Region / climate
        <select
          className="mt-2 min-h-[52px] w-full rounded-xl border-4 border-black bg-white px-4 text-lg font-semibold text-slate-900"
          value={climate}
          onChange={(e) => setClimate(e.target.value)}
        >
          {CLIMATE_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-lg font-bold text-slate-900">
        What should we call you?{" "}
        <span className="font-normal text-slate-600">(optional)</span>
        <input
          className="mt-2 min-h-[52px] w-full rounded-xl border-4 border-black bg-white px-4 text-lg font-semibold text-slate-900"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="First name or nickname"
          autoComplete="nickname"
        />
      </label>

      <p className="mt-5 text-lg font-semibold text-slate-800">
        Next, add the medications you take — Tiaki starts with an empty list so
        it stays private on shared devices.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={finish.isPending}
          onClick={() => finish.mutate()}
          className="min-h-[56px] flex-1 rounded-xl border-4 border-black bg-sky-600 px-5 text-lg font-black uppercase tracking-wide text-white shadow hover:bg-sky-700 disabled:opacity-50"
        >
          Save &amp; continue
        </button>
        <Link
          href="/meds"
          className="flex min-h-[56px] flex-1 items-center justify-center rounded-xl border-4 border-black bg-white px-5 text-lg font-black uppercase tracking-wide text-slate-900 shadow hover:bg-slate-50"
        >
          Open medications
        </Link>
      </div>
    </section>
  );
}
