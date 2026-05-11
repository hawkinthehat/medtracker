"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import { getActiveMedications } from "@/lib/medication-active";
import { isBaselinesComplete } from "@/lib/baselines-storage";

const LS_LOC_ACK = "tiaki-barometer-checklist-ack-v1";

/** Card shell + scroll body + pinned actions (aligned with WelcomeWizard). */
const SLIDE_SHELL =
  "flex h-[min(75vh,calc(100dvh-10rem))] max-h-[75vh] w-[min(92vw,380px)] shrink-0 snap-start flex-col overflow-hidden rounded-xl border-2 border-emerald-900 bg-emerald-50 shadow-md";

const SLIDE_SCROLL =
  "max-h-[75vh] min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3";

const STEP_ACTION_BAR =
  "sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]";

function readLocAck(): boolean {
  try {
    return window.localStorage.getItem(LS_LOC_ACK) === "1";
  } catch {
    return false;
  }
}

function writeLocAck() {
  try {
    window.localStorage.setItem(LS_LOC_ACK, "1");
  } catch {
    /* ignore */
  }
}

function useSetupChecklistState() {
  const { data: medications = [] } = useQuery({
    queryKey: qk.medications,
    queryFn: fetchMedicationsQuery,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const [baselinesDone, setBaselinesDone] = useState(false);
  const [locAck, setLocAck] = useState(false);

  useEffect(() => {
    setBaselinesDone(isBaselinesComplete());
    setLocAck(readLocAck());
    const onBaselines = () => setBaselinesDone(isBaselinesComplete());
    window.addEventListener("tiaki-baselines-updated", onBaselines);
    return () =>
      window.removeEventListener("tiaki-baselines-updated", onBaselines);
  }, []);

  const activeCount = useMemo(
    () => getActiveMedications(medications).length,
    [medications],
  );

  const medsDone = activeCount > 0;
  const allDone = baselinesDone && medsDone && locAck;

  return {
    baselinesDone,
    medsDone,
    locAck,
    setLocAck,
    allDone,
  };
}

/**
 * Horizontal slides for the home dashboard carousel (one incomplete step per card).
 */
export function SetupChecklistCarouselSlides() {
  const { baselinesDone, medsDone, locAck, setLocAck, allDone } =
    useSetupChecklistState();

  if (allDone) return null;

  const slides: ReactElement[] = [];

  if (!baselinesDone) {
    slides.push(
      <div key="setup-baseline" className={SLIDE_SHELL} role="status">
        <div className={SLIDE_SCROLL}>
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-950">
            Step 1 of 3
          </p>
          <p className="mt-1 text-lg font-black leading-snug text-slate-950">
            Water &amp; salt goals
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            Set targets so hydration tracking matches your care plan.
          </p>
        </div>
        <div className={STEP_ACTION_BAR}>
          <Link
            href="/profile-setup"
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-black bg-white px-3 text-sm font-black uppercase tracking-wide text-slate-950 shadow-sm transition hover:bg-slate-50"
          >
            Open profile setup
          </Link>
        </div>
      </div>,
    );
  }

  if (!medsDone) {
    slides.push(
      <div key="setup-meds" className={SLIDE_SHELL} role="status">
        <div className={SLIDE_SCROLL}>
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-950">
            Step 2 of 3
          </p>
          <p className="mt-1 text-lg font-black leading-snug text-slate-950">
            First medication
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            Add at least one active medication to unlock reminders and exports.
          </p>
        </div>
        <div className={STEP_ACTION_BAR}>
          <Link
            href="/meds"
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-black bg-white px-3 text-sm font-black uppercase tracking-wide text-slate-950 shadow-sm transition hover:bg-slate-50"
          >
            Open medications
          </Link>
        </div>
      </div>,
    );
  }

  if (!locAck) {
    slides.push(
      <div key="setup-loc" className={SLIDE_SHELL} role="status">
        <div className={SLIDE_SCROLL}>
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-950">
            Step 3 of 3
          </p>
          <p className="mt-1 text-lg font-black leading-snug text-slate-950">
            Location for barometer
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            Tiaki uses GPS with OpenWeather for your current area — not a fixed
            city.
          </p>
        </div>
        <div className={`${STEP_ACTION_BAR} flex flex-col gap-2`}>
          <a
            href="#tiaki-barometer"
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-black bg-sky-600 px-3 text-xs font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-sky-500"
          >
            Jump to barometer
          </a>
          <button
            type="button"
            onClick={() => {
              writeLocAck();
              setLocAck(true);
            }}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-black bg-white px-3 text-xs font-black uppercase tracking-wide text-slate-950 shadow-sm transition hover:bg-slate-50"
          >
            I enabled location
          </button>
        </div>
      </div>,
    );
  }

  return <>{slides}</>;
}

/**
 * Onboarding checklist: water goals, first medication, location for barometer.
 * Hidden once all three are satisfied (location step can be acknowledged).
 */
export default function NewUserSetupChecklist() {
  const { baselinesDone, medsDone, locAck, setLocAck, allDone } =
    useSetupChecklistState();

  if (allDone) return null;

  return (
    <aside
      role="status"
      className="rounded-2xl border-4 border-emerald-900 bg-emerald-50 px-5 py-5 shadow-md"
    >
      <p className="text-xl font-black leading-snug text-slate-950">
        Getting started
      </p>
      <p className="mt-2 text-base font-semibold text-slate-800">
        Complete these steps so Tiaki can support your day and specialist visits.
      </p>
      <ol className="mt-5 space-y-4 text-base font-semibold text-slate-900">
        <li className="flex flex-wrap items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black text-sm font-black ${
              baselinesDone ? "bg-emerald-500 text-white" : "bg-white"
            }`}
            aria-hidden
          >
            {baselinesDone ? "✓" : "1"}
          </span>
          <div className="min-w-0 flex-1">
            <p>Set your daily water and salt goals</p>
            {!baselinesDone ? (
              <Link
                href="/profile-setup"
                className="mt-2 inline-flex min-h-[48px] items-center justify-center rounded-xl border-4 border-black bg-white px-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-sm transition hover:bg-slate-50"
              >
                Open profile setup
              </Link>
            ) : (
              <p className="mt-1 text-sm font-medium text-emerald-900">Done</p>
            )}
          </div>
        </li>
        <li className="flex flex-wrap items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black text-sm font-black ${
              medsDone ? "bg-emerald-500 text-white" : "bg-white"
            }`}
            aria-hidden
          >
            {medsDone ? "✓" : "2"}
          </span>
          <div className="min-w-0 flex-1">
            <p>Add your first medication</p>
            {!medsDone ? (
              <Link
                href="/meds"
                className="mt-2 inline-flex min-h-[48px] items-center justify-center rounded-xl border-4 border-black bg-white px-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-sm transition hover:bg-slate-50"
              >
                Open medications
              </Link>
            ) : (
              <p className="mt-1 text-sm font-medium text-emerald-900">Done</p>
            )}
          </div>
        </li>
        <li className="flex flex-wrap items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black text-sm font-black ${
              locAck ? "bg-emerald-500 text-white" : "bg-white"
            }`}
            aria-hidden
          >
            {locAck ? "✓" : "3"}
          </span>
          <div className="min-w-0 flex-1">
            <p>Allow location for barometric advisories</p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              Tiaki uses your device GPS with OpenWeather — not a fixed city.
              Scroll to the barometer card and enable alerts when you are ready.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <a
                href="#tiaki-barometer"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border-4 border-black bg-sky-600 px-4 text-sm font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-sky-500"
              >
                Jump to barometer
              </a>
              {!locAck ? (
                <button
                  type="button"
                  onClick={() => {
                    writeLocAck();
                    setLocAck(true);
                  }}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl border-4 border-black bg-white px-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-sm transition hover:bg-slate-50"
                >
                  I enabled location
                </button>
              ) : null}
            </div>
          </div>
        </li>
      </ol>
    </aside>
  );
}
