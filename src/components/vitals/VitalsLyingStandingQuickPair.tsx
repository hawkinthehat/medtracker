"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import type { FormEventHandler, Dispatch, SetStateAction } from "react";
import type { VitalRow } from "@/lib/types";

type SavePairMutation = Pick<
  UseMutationResult<
    { lying: VitalRow; standing: VitalRow },
    Error,
    { lying: VitalRow; standing: VitalRow }
  >,
  "isPending" | "isError" | "error"
>;

type DeltaSummary = {
  sysLine: string;
  diaLine: string;
  hrLine: string | null;
};

type Parsed = { systolic: number; diastolic: number; heartRate?: number };

type Props = {
  lieSys: string;
  setLieSys: (v: string) => void;
  lieDia: string;
  setLieDia: (v: string) => void;
  lieHr: string;
  setLieHr: (v: string) => void;
  standSys: string;
  setStandSys: (v: string) => void;
  standDia: string;
  setStandDia: (v: string) => void;
  standHr: string;
  setStandHr: (v: string) => void;
  compressionGear: boolean;
  setCompressionGear: Dispatch<SetStateAction<boolean>>;
  pairNotes: string;
  setPairNotes: (v: string) => void;
  deltaSummary: DeltaSummary | null;
  lyingParsed: Parsed | null;
  standingParsed: Parsed | null;
  saveLyingStandingPair: SavePairMutation;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export default function VitalsLyingStandingQuickPair({
  lieSys,
  setLieSys,
  lieDia,
  setLieDia,
  lieHr,
  setLieHr,
  standSys,
  setStandSys,
  standDia,
  setStandDia,
  standHr,
  setStandHr,
  compressionGear,
  setCompressionGear,
  pairNotes,
  setPairNotes,
  deltaSummary,
  lyingParsed,
  standingParsed,
  saveLyingStandingPair,
  onSubmit,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
      <h2 className="text-lg font-semibold text-slate-900">
        Lying vs standing (POTS / OH quick pair)
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Enter both sets, then save — Tiaki writes two rows to{" "}
        <code className="rounded bg-slate-200 px-1 py-0.5 text-xs text-slate-900">
          vitals_readings
        </code>{" "}
        (lying row, then standing) with the same pair id in notes for
        correlation.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-6">
        <div className="rounded-xl border-2 border-slate-300 bg-slate-50/80 p-4">
          <h3 className="text-base font-bold text-slate-900">Lying down</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Systolic
              <input
                inputMode="numeric"
                className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                value={lieSys}
                onChange={(e) => setLieSys(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Diastolic
              <input
                inputMode="numeric"
                className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                value={lieDia}
                onChange={(e) => setLieDia(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              HR (optional)
              <input
                inputMode="numeric"
                className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                value={lieHr}
                onChange={(e) => setLieHr(e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border-2 border-slate-300 bg-white p-4">
          <h3 className="text-base font-bold text-slate-900">Standing up</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Systolic
              <input
                inputMode="numeric"
                className="w-28 rounded-lg border border-slate-300 bg-gray-50 px-3 py-2 text-slate-900"
                value={standSys}
                onChange={(e) => setStandSys(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Diastolic
              <input
                inputMode="numeric"
                className="w-28 rounded-lg border border-slate-300 bg-gray-50 px-3 py-2 text-slate-900"
                value={standDia}
                onChange={(e) => setStandDia(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              HR (optional)
              <input
                inputMode="numeric"
                className="w-28 rounded-lg border border-slate-300 bg-gray-50 px-3 py-2 text-slate-900"
                value={standHr}
                onChange={(e) => setStandHr(e.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
        </div>

        <div
          className={`rounded-xl border-4 p-4 ${
            deltaSummary
              ? "border-sky-600 bg-sky-50"
              : "border-slate-200 bg-slate-100"
          }`}
          aria-live="polite"
        >
          <p className="text-sm font-bold uppercase tracking-wide text-slate-800">
            Change (auto)
          </p>
          {deltaSummary ? (
            <ul className="mt-2 space-y-1 text-base font-semibold text-slate-900">
              <li>{deltaSummary.sysLine}</li>
              <li>{deltaSummary.diaLine}</li>
              {deltaSummary.hrLine && <li>{deltaSummary.hrLine}</li>}
            </ul>
          ) : (
            <p className="mt-2 text-sm font-medium text-slate-600">
              Enter complete lying and standing BP to see deltas. Positive
              systolic/diastolic Δ (lying − standing) reflects a drop after
              standing.
            </p>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={compressionGear}
          onClick={() => setCompressionGear((v) => !v)}
          className={`flex min-h-[56px] w-full items-center justify-center rounded-2xl border-4 border-black px-4 py-4 text-lg font-black uppercase tracking-wide transition ${
            compressionGear
              ? "bg-violet-600 text-white"
              : "bg-white text-slate-900 hover:bg-slate-50"
          }`}
        >
          Wearing compression gear? {compressionGear ? "Yes" : "No"}
        </button>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Notes (optional)
          <input
            className="rounded-lg border border-slate-300 bg-gray-50 px-3 py-2 text-slate-900"
            value={pairNotes}
            onChange={(e) => setPairNotes(e.target.value)}
            placeholder="Symptoms, time standing, etc."
          />
        </label>

        {saveLyingStandingPair.isError &&
          saveLyingStandingPair.error instanceof Error && (
            <p className="text-sm font-bold text-red-700" role="alert">
              {saveLyingStandingPair.error.message}
            </p>
          )}

        <button
          type="submit"
          disabled={
            !lyingParsed ||
            !standingParsed ||
            saveLyingStandingPair.isPending
          }
          className="w-full rounded-xl bg-slate-900 py-4 text-base font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveLyingStandingPair.isPending
            ? "Saving…"
            : "Save lying & standing pair"}
        </button>
      </form>
    </section>
  );
}
