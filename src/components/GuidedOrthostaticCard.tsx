"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FeatureHelpTrigger } from "@/components/FeatureHelpModal";
import type { BpHrReading, OrthostaticSession } from "@/lib/types";

type StageProps = {
  title: string;
  subtitle?: string;
  sys: string;
  dia: string;
  hr: string;
  onSys: (v: string) => void;
  onDia: (v: string) => void;
  onHr: (v: string) => void;
};

function StageInputs({
  title,
  subtitle,
  sys,
  dia,
  hr,
  onSys,
  onDia,
  onHr,
}: StageProps) {
  const inputCls =
    "w-full max-w-[8rem] rounded-lg border-2 border-white/25 bg-black px-3 py-2.5 text-base font-medium text-white tabular-nums placeholder:text-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400";
  return (
    <div className="rounded-xl border-2 border-white/20 bg-black/40 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-amber-200">
        {title}
      </h3>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-700">{subtitle}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex min-w-[7rem] flex-col gap-1.5 text-xs font-semibold text-white">
          Systolic
          <input
            inputMode="numeric"
            className={inputCls}
            value={sys}
            onChange={(e) => onSys(e.target.value)}
            placeholder="—"
            aria-label={`${title} systolic mmHg`}
          />
        </label>
        <label className="flex min-w-[7rem] flex-col gap-1.5 text-xs font-semibold text-white">
          Diastolic
          <input
            inputMode="numeric"
            className={inputCls}
            value={dia}
            onChange={(e) => onDia(e.target.value)}
            placeholder="—"
            aria-label={`${title} diastolic mmHg`}
          />
        </label>
        <label className="flex min-w-[7rem] flex-col gap-1.5 text-xs font-semibold text-white">
          Heart rate
          <input
            inputMode="numeric"
            className={inputCls}
            value={hr}
            onChange={(e) => onHr(e.target.value)}
            placeholder="—"
            aria-label={`${title} heart rate`}
          />
        </label>
      </div>
    </div>
  );
}

function parseHr(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function buildReading(
  sys: string,
  dia: string,
  hr: string,
): BpHrReading | null {
  const s = Number(sys);
  const d = Number(dia);
  if (Number.isNaN(s) || Number.isNaN(d)) return null;
  const h = parseHr(hr);
  return {
    systolic: s,
    diastolic: d,
    ...(h !== undefined ? { heartRate: h } : {}),
  };
}

const ACTIVE_STAND_SYMPTOMS = [
  "Dizziness",
  "Palpitations",
  "Tremor",
  "Syncope",
] as const;

type Props = {
  onSaveSession: (session: OrthostaticSession) => void;
};

export function GuidedOrthostaticCard({ onSaveSession }: Props) {
  const [testStarted, setTestStarted] = useState(false);
  const [lying, setLying] = useState({ sys: "", dia: "", hr: "" });
  const [stand1m, setStand1m] = useState({ sys: "", dia: "", hr: "" });
  const [stand10m, setStand10m] = useState({ sys: "", dia: "", hr: "" });
  const [symptomPick, setSymptomPick] = useState<Set<string>>(() => new Set());

  const lieRead = useMemo(
    () => buildReading(lying.sys, lying.dia, lying.hr),
    [lying],
  );
  const s1Read = useMemo(
    () => buildReading(stand1m.sys, stand1m.dia, stand1m.hr),
    [stand1m],
  );
  const s10Read = useMemo(
    () => buildReading(stand10m.sys, stand10m.dia, stand10m.hr),
    [stand10m],
  );

  const deltaVs10 = useMemo(() => {
    if (!lieRead || !s10Read) return null;
    const deltaSystolic = lieRead.systolic - s10Read.systolic;
    const deltaDiastolic = lieRead.diastolic - s10Read.diastolic;
    const positiveOrthostatic =
      deltaSystolic >= 20 || deltaDiastolic >= 10;
    let hrJump1: number | null = null;
    let hrJump10: number | null = null;
    if (
      lieRead.heartRate != null &&
      s1Read?.heartRate != null
    ) {
      hrJump1 = s1Read.heartRate - lieRead.heartRate;
    }
    if (
      lieRead.heartRate != null &&
      s10Read.heartRate != null
    ) {
      hrJump10 = s10Read.heartRate - lieRead.heartRate;
    }
    const hrVals = [hrJump1, hrJump10].filter(
      (x): x is number => x != null && Number.isFinite(x),
    );
    const maxHrJump = hrVals.length ? Math.max(...hrVals) : null;
    const potsSuspect =
      maxHrJump != null && maxHrJump > 30;
    const bpAlert = positiveOrthostatic;
    const hrAlert = potsSuspect;
    return {
      deltaSystolic,
      deltaDiastolic,
      positiveOrthostatic,
      potsSuspect,
      hrJump1,
      hrJump10,
      bpAlert,
      hrAlert,
    };
  }, [lieRead, s1Read, s10Read]);

  function reset() {
    setLying({ sys: "", dia: "", hr: "" });
    setStand1m({ sys: "", dia: "", hr: "" });
    setStand10m({ sys: "", dia: "", hr: "" });
    setSymptomPick(new Set());
  }

  function toggleSymptom(s: string) {
    setSymptomPick((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function save() {
    const lie = lieRead;
    const s1 = s1Read;
    const s10 = s10Read;
    if (!lie || !s1 || !s10 || !deltaVs10) return;

    const deltaSystolic = lie.systolic - s10.systolic;
    const deltaDiastolic = lie.diastolic - s10.diastolic;
    const positiveOrthostatic =
      deltaSystolic >= 20 || deltaDiastolic >= 10;

    let potsSuspect = false;
    if (lie.heartRate != null && s1.heartRate != null) {
      if (s1.heartRate - lie.heartRate > 30) potsSuspect = true;
    }
    if (lie.heartRate != null && s10.heartRate != null) {
      if (s10.heartRate - lie.heartRate > 30) potsSuspect = true;
    }

    const symptoms =
      symptomPick.size > 0 ? Array.from(symptomPick) : undefined;

    const session: OrthostaticSession = {
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      lying: lie,
      sitting: lie,
      standing1m: s1,
      standing10m: s10,
      standing3m: s10,
      standing: s10,
      deltaSystolic,
      deltaDiastolic,
      positiveOrthostatic,
      potsSuspect,
      ...(symptoms ? { activeStandSymptoms: symptoms } : {}),
    };
    onSaveSession(session);
    reset();
    setTestStarted(false);
  }

  const canSave = lieRead && s1Read && s10Read;

  if (!testStarted) {
    return (
      <section
        id="guided-active-stand"
        className="rounded-2xl border-2 border-amber-500/50 bg-black p-4 shadow-xl ring-2 ring-amber-500/20 sm:p-5"
        aria-labelledby="active-stand-teaser-heading"
      >
        <p
          id="active-stand-teaser-heading"
          className="text-base font-semibold leading-snug text-white sm:text-lg"
        >
          <span className="font-black text-amber-200">Active Stand Test:</span>{" "}
          Compare lying vs. standing BP.
        </p>
        <button
          type="button"
          onClick={() => setTestStarted(true)}
          className="mt-4 min-h-[60px] w-full rounded-xl bg-amber-500 px-4 py-3 text-base font-black uppercase tracking-wide text-black shadow-md transition hover:bg-amber-400 focus-visible:outline focus-visible:ring-4 focus-visible:ring-amber-300"
        >
          Start Test
        </button>
      </section>
    );
  }

  return (
    <section
      id="guided-active-stand"
      className="rounded-2xl border-2 border-amber-500/50 bg-black p-3 shadow-xl ring-2 ring-amber-500/20 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black tracking-tight text-white sm:text-3xl">
            Active Stand Test
          </h2>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-amber-100/95 sm:text-sm">
            Poor man&apos;s tilt table — supine rest, then standing at 1 and 10
            minutes. Deltas use{" "}
            <span className="font-black text-amber-200">lying → standing (10m)</span>{" "}
            for BP; HR alert if jump &gt;30 vs lying at either standing timepoint.
          </p>
        </div>
        <FeatureHelpTrigger
          ariaLabel="How to take the active stand test"
          title="Active Stand Test"
        >
          <p>
            <strong>Why it matters:</strong> Lying vs standing BP and HR is the
            practical gold standard screen for orthostatic hypotension (OH) and
            supports many POTS evaluations — your doctor looks for big BP drops
            and HR jumps when you stand.
          </p>
          <p>
            <strong>How to measure:</strong> Rest lying flat ~5 minutes, then log
            BP and HR. Stand still — log again at 1 minute and at ~10 minutes.
            Use the same arm and cuff position each time.
          </p>
          <p>
            <strong>Tips:</strong> Avoid talking or pacing during stands; note
            symptoms like dizziness or palpitations so they sit alongside your
            numbers in reports.
          </p>
        </FeatureHelpTrigger>
      </div>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm font-bold text-amber-50/95">
        <li>
          <strong className="text-white">Supine:</strong> rest lying down ~5
          minutes, then enter BP/HR.
        </li>
        <li>
          <strong className="text-white">Standing (1 min):</strong> stand
          quietly; measure at 1 minute.
        </li>
        <li>
          <strong className="text-white">Standing (10 min):</strong> remain
          standing; measure at 10 minutes.
        </li>
      </ol>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <StageInputs
          title="Step 1 · Supine"
          subtitle="After ~5 min rest."
          sys={lying.sys}
          dia={lying.dia}
          hr={lying.hr}
          onSys={(v) => setLying((p) => ({ ...p, sys: v }))}
          onDia={(v) => setLying((p) => ({ ...p, dia: v }))}
          onHr={(v) => setLying((p) => ({ ...p, hr: v }))}
        />
        <StageInputs
          title="Step 2 · Standing 1 min"
          subtitle="Quiet stance."
          sys={stand1m.sys}
          dia={stand1m.dia}
          hr={stand1m.hr}
          onSys={(v) => setStand1m((p) => ({ ...p, sys: v }))}
          onDia={(v) => setStand1m((p) => ({ ...p, dia: v }))}
          onHr={(v) => setStand1m((p) => ({ ...p, hr: v }))}
        />
        <StageInputs
          title="Step 3 · Standing 10 min"
          subtitle="Sustained orthostatic stress."
          sys={stand10m.sys}
          dia={stand10m.dia}
          hr={stand10m.hr}
          onSys={(v) => setStand10m((p) => ({ ...p, sys: v }))}
          onDia={(v) => setStand10m((p) => ({ ...p, dia: v }))}
          onHr={(v) => setStand10m((p) => ({ ...p, hr: v }))}
        />
      </div>

      <div className="mt-6 rounded-xl border border-white/20 bg-zinc-950/80 px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Symptoms during the test
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ACTIVE_STAND_SYMPTOMS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSymptom(s)}
              className={`min-h-[48px] rounded-xl border-2 px-4 text-sm font-black ${
                symptomPick.has(s)
                  ? "border-amber-400 bg-amber-500/30 text-amber-50"
                  : "border-white/25 text-slate-700 hover:bg-white/10"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {deltaVs10 && (
        <div className="mt-6 rounded-xl border border-white/20 bg-zinc-950 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Delta (lying − standing 10m) · HR jumps vs lying
          </p>
          <p
            className={`mt-2 font-mono text-xl font-semibold tabular-nums ${
              deltaVs10.bpAlert || deltaVs10.hrAlert
                ? "text-red-400"
                : "text-white"
            }`}
          >
            Δ BP: {deltaVs10.deltaSystolic} / {deltaVs10.deltaDiastolic} mmHg
            {" · "}
            Δ HR @1m:{" "}
            {deltaVs10.hrJump1 != null ? `+${deltaVs10.hrJump1} bpm` : "—"}
            {" · "}
            Δ HR @10m:{" "}
            {deltaVs10.hrJump10 != null ? `+${deltaVs10.hrJump10} bpm` : "—"}
          </p>
          {deltaVs10.bpAlert && (
            <p className="mt-3 text-center text-base font-black uppercase text-red-300">
              BP drop meets common orthostatic screen (≥20 systolic and/or ≥10
              diastolic)
            </p>
          )}
          {deltaVs10.hrAlert && (
            <p className="mt-2 text-center text-base font-black uppercase text-red-300">
              HR rise &gt;30 bpm — discuss POTS / orthostatic intolerance with
              your clinician
            </p>
          )}
          {!deltaVs10.bpAlert && !deltaVs10.hrAlert && (
            <p className="mt-3 text-sm text-slate-400">
              Thresholds not met on numbers alone; still save if you felt
              symptomatic.
            </p>
          )}
          <Link
            href="/journal"
            className="mt-4 flex w-full items-center justify-center rounded-lg border-2 border-white/30 bg-black px-4 py-3 text-sm font-bold text-white hover:bg-zinc-900"
          >
            Add free-text symptoms in journal
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canSave}
          onClick={save}
          className="min-h-[48px] flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save active stand session
        </button>
        <button
          type="button"
          onClick={reset}
          className="min-h-[48px] rounded-xl border-2 border-white/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          Clear
        </button>
      </div>
    </section>
  );
}

export default GuidedOrthostaticCard;
