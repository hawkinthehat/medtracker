"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrthostaticSession } from "@/lib/types";

type Stage = "lying" | "sitting" | "standing";

/** Standing flow: 1 min stand → BP, then 2 more minutes → BP at 3 min total standing. */
type StandPhase = "off" | "t60" | "i1" | "t120" | "i3";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function badgeLabel(stage: Stage, standPhase: StandPhase): string {
  if (stage === "lying") return "Lying";
  if (stage === "sitting") return "Sitting";
  if (standPhase === "t60") return "Standing · 1 min wait";
  if (standPhase === "i1") return "Standing · 1 min BP";
  if (standPhase === "t120") return "Standing · 2 min wait";
  if (standPhase === "i3") return "Standing · 3 min BP";
  return "Standing";
}

type Props = {
  onComplete: (session: OrthostaticSession) => void;
};

export default function OrthostaticTracker({ onComplete }: Props) {
  const [stage, setStage] = useState<Stage>("lying");
  const [standPhase, setStandPhase] = useState<StandPhase>("off");

  const [lying, setLying] = useState({ sys: "", dia: "" });
  const [sitting, setSitting] = useState({ sys: "", dia: "" });
  const [standing1m, setStanding1m] = useState({ sys: "", dia: "" });
  const [standing3m, setStanding3m] = useState({ sys: "", dia: "" });

  const [sitTimerActive, setSitTimerActive] = useState(false);
  const [sitSecondsLeft, setSitSecondsLeft] = useState(60);

  const [standTimerActive, setStandTimerActive] = useState(false);
  const [standSecondsLeft, setStandSecondsLeft] = useState(60);

  useEffect(() => {
    if (!sitTimerActive) return;
    const id = window.setInterval(() => {
      setSitSecondsLeft((t) => {
        if (t <= 1) {
          setSitTimerActive(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [sitTimerActive]);

  useEffect(() => {
    if (!standTimerActive) return;
    const id = window.setInterval(() => {
      setStandSecondsLeft((t) => {
        if (t <= 1) {
          setStandTimerActive(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [standTimerActive]);

  useEffect(() => {
    if (standTimerActive) return;
    if (standSecondsLeft !== 0) return;
    if (standPhase === "t60") setStandPhase("i1");
    else if (standPhase === "t120") setStandPhase("i3");
  }, [standTimerActive, standSecondsLeft, standPhase]);

  const lyingDone = lying.sys !== "" && lying.dia !== "";
  const sittingDone = sitting.sys !== "" && sitting.dia !== "";
  const standing1Done = standing1m.sys !== "" && standing1m.dia !== "";
  const standing3Done = standing3m.sys !== "" && standing3m.dia !== "";

  const showSittingInputs =
    lyingDone &&
    stage === "sitting" &&
    !sitTimerActive &&
    sitSecondsLeft === 0;

  const showStandTimer =
    stage === "standing" && (standPhase === "t60" || standPhase === "t120");

  const showStanding1Inputs =
    stage === "standing" && standPhase === "i1" && !showStandTimer;

  const showStanding2Inputs =
    stage === "standing" && standPhase === "i3" && !showStandTimer;

  const result = useMemo(() => {
    if (!lyingDone || !sittingDone || !standing1Done || !standing3Done)
      return null;
    const lSys = Number(lying.sys);
    const lDia = Number(lying.dia);
    const sSys = Number(sitting.sys);
    const sDia = Number(sitting.dia);
    const st1Sys = Number(standing1m.sys);
    const st1Dia = Number(standing1m.dia);
    const st3Sys = Number(standing3m.sys);
    const st3Dia = Number(standing3m.dia);
    if (
      [lSys, lDia, sSys, sDia, st1Sys, st1Dia, st3Sys, st3Dia].some((n) =>
        Number.isNaN(n)
      )
    )
      return null;

    const deltaSystolic = lSys - st3Sys;
    const deltaDiastolic = lDia - st3Dia;
    const positiveOrthostatic = deltaSystolic >= 20 || deltaDiastolic >= 10;

    return {
      lying: { systolic: lSys, diastolic: lDia },
      sitting: { systolic: sSys, diastolic: sDia },
      standing1m: { systolic: st1Sys, diastolic: st1Dia },
      standing3m: { systolic: st3Sys, diastolic: st3Dia },
      standing: { systolic: st3Sys, diastolic: st3Dia },
      deltaSystolic,
      deltaDiastolic,
      positiveOrthostatic,
    };
  }, [lying, sitting, standing1m, standing3m, lyingDone, sittingDone, standing1Done, standing3Done]);

  const advanceToSitting = useCallback(() => {
    setStage("sitting");
    setSitSecondsLeft(60);
    setSitTimerActive(true);
  }, []);

  const advanceToStanding = useCallback(() => {
    setStage("standing");
    setStandPhase("t60");
    setStandSecondsLeft(60);
    setStandTimerActive(true);
  }, []);

  const continueAfterStanding1m = useCallback(() => {
    if (!standing1Done) return;
    setStandPhase("t120");
    setStandSecondsLeft(120);
    setStandTimerActive(true);
  }, [standing1Done]);

  const reset = useCallback(() => {
    setStage("lying");
    setStandPhase("off");
    setLying({ sys: "", dia: "" });
    setSitting({ sys: "", dia: "" });
    setStanding1m({ sys: "", dia: "" });
    setStanding3m({ sys: "", dia: "" });
    setSitTimerActive(false);
    setSitSecondsLeft(60);
    setStandTimerActive(false);
    setStandSecondsLeft(60);
  }, []);

  const saveSession = useCallback(() => {
    if (!result) return;
    const session: OrthostaticSession = {
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      ...result,
    };
    onComplete(session);
    reset();
  }, [onComplete, reset, result]);

  return (
    <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 shadow-lg ring-1 ring-slate-200/60">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Orthostatic BP
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Lying → Sitting (60s rest) → Stand: 1 min → BP → 2 more min → BP at
            3 min standing. Positional delta chart uses all four positions after
            you save.
          </p>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium uppercase tracking-wider text-sky-300">
          {badgeLabel(stage, standPhase)}
        </span>
      </div>

      <ol className="space-y-6">
        <li className="rounded-xl border border-slate-300 bg-slate-100/80 p-4">
          <p className="mb-3 font-medium text-slate-800">1. Lying</p>
          <p className="mb-3 text-sm text-slate-400">
            Lie flat ~5 minutes, then measure blood pressure.
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Systolic
              <input
                inputMode="numeric"
                className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="120"
                value={lying.sys}
                onChange={(e) =>
                  setLying((p) => ({ ...p, sys: e.target.value }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Diastolic
              <input
                inputMode="numeric"
                className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="80"
                value={lying.dia}
                onChange={(e) =>
                  setLying((p) => ({ ...p, dia: e.target.value }))
                }
              />
            </label>
          </div>
          {lyingDone && stage === "lying" && (
            <button
              type="button"
              onClick={advanceToSitting}
              className="mt-4 w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              Continue to Sitting
            </button>
          )}
        </li>

        <li className="rounded-xl border border-slate-300 bg-slate-100/80 p-4">
          <p className="mb-3 font-medium text-slate-800">2. Sitting</p>
          {sitTimerActive && stage === "sitting" && (
            <p
              className="mb-3 font-mono text-2xl font-semibold tabular-nums text-sky-300"
              aria-live="polite"
            >
              {formatTime(sitSecondsLeft)}
            </p>
          )}
          {stage === "sitting" && showSittingInputs && (
            <p className="mb-3 text-sm text-emerald-400">Timer complete.</p>
          )}
          {!lyingDone && (
            <p className="text-sm text-slate-500">Complete lying BP first.</p>
          )}
          {lyingDone && stage === "standing" && (
            <p className="text-sm text-slate-500">Sitting stage finished.</p>
          )}
          {showSittingInputs && (
            <>
              <div className="flex flex-wrap gap-3">
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  Systolic
                  <input
                    inputMode="numeric"
                    className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={sitting.sys}
                    onChange={(e) =>
                      setSitting((p) => ({ ...p, sys: e.target.value }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  Diastolic
                  <input
                    inputMode="numeric"
                    className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={sitting.dia}
                    onChange={(e) =>
                      setSitting((p) => ({ ...p, dia: e.target.value }))
                    }
                  />
                </label>
              </div>
              {sittingDone && (
                <button
                  type="button"
                  onClick={advanceToStanding}
                  className="mt-4 w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                >
                  Continue to Standing
                </button>
              )}
            </>
          )}
        </li>

        <li className="rounded-xl border border-slate-300 bg-slate-100/80 p-4">
          <p className="mb-3 font-medium text-slate-800">3. Standing (1m &amp; 3m)</p>
          {showStandTimer && (
            <p
              className="mb-3 font-mono text-2xl font-semibold tabular-nums text-sky-300"
              aria-live="polite"
            >
              {formatTime(standSecondsLeft)}
            </p>
          )}
          {showStanding1Inputs && (
            <p className="mb-3 text-sm text-emerald-400">
              1 minute standing — enter BP.
            </p>
          )}
          {showStanding2Inputs && (
            <p className="mb-3 text-sm text-emerald-400">
              3 minutes total standing — enter BP.
            </p>
          )}
          {stage !== "standing" && (
            <p className="mb-3 text-sm text-slate-500">
              Unlocks after sitting BP, then stand for timed intervals.
            </p>
          )}
          {showStanding1Inputs && (
            <>
              <div className="flex flex-wrap gap-3">
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  Systolic (1m standing)
                  <input
                    inputMode="numeric"
                    className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={standing1m.sys}
                    onChange={(e) =>
                      setStanding1m((p) => ({ ...p, sys: e.target.value }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  Diastolic (1m standing)
                  <input
                    inputMode="numeric"
                    className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    value={standing1m.dia}
                    onChange={(e) =>
                      setStanding1m((p) => ({ ...p, dia: e.target.value }))
                    }
                  />
                </label>
              </div>
              {standing1Done && (
                <button
                  type="button"
                  onClick={continueAfterStanding1m}
                  className="mt-4 w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                >
                  Continue — wait 2 more minutes (then 3m BP)
                </button>
              )}
            </>
          )}
          {showStanding2Inputs && (
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Systolic (3m standing)
                <input
                  inputMode="numeric"
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  value={standing3m.sys}
                  onChange={(e) =>
                    setStanding3m((p) => ({ ...p, sys: e.target.value }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Diastolic (3m standing)
                <input
                  inputMode="numeric"
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  value={standing3m.dia}
                  onChange={(e) =>
                    setStanding3m((p) => ({ ...p, dia: e.target.value }))
                  }
                />
              </label>
            </div>
          )}
        </li>
      </ol>

      {result && (
        <div className="mt-6 space-y-3 rounded-xl border border-slate-300 bg-white p-4">
          <p className="text-sm font-medium text-slate-800">
            Delta (Lying → Standing 3m)
          </p>
          <p className="font-mono text-lg tabular-nums text-slate-900">
            Δ Systolic: {result.deltaSystolic} mmHg · Δ Diastolic:{" "}
            {result.deltaDiastolic} mmHg
          </p>
          {result.positiveOrthostatic ? (
            <p className="rounded-lg border border-red-500/50 bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-300">
              Positive for Orthostatic Hypotension. Systolic dropped ≥ 20 mmHg
              and/or diastolic dropped ≥ 10 mmHg (lying → standing 3m). Share
              with your clinician.
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              Threshold not met for orthostatic hypotension on this measure.
              Still discuss symptoms with your care team if lightheaded.
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={saveSession}
              className="flex-1 rounded-xl bg-emerald-700 py-3 text-sm font-semibold text-white hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              Save session
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-800"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
