"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  hr: string
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

type Props = {
  onSaveSession: (session: OrthostaticSession) => void;
};

export function GuidedOrthostaticCard({ onSaveSession }: Props) {
  const [lying, setLying] = useState({ sys: "", dia: "", hr: "" });
  const [sitting, setSitting] = useState({ sys: "", dia: "", hr: "" });
  const [standing, setStanding] = useState({ sys: "", dia: "", hr: "" });

  const delta = useMemo(() => {
    const lie = buildReading(lying.sys, lying.dia, lying.hr);
    const stand = buildReading(standing.sys, standing.dia, standing.hr);
    if (!lie || !stand) return null;
    const deltaSystolic = lie.systolic - stand.systolic;
    const deltaDiastolic = lie.diastolic - stand.diastolic;
    const positiveOrthostatic =
      deltaSystolic >= 20 || deltaDiastolic >= 10;
    return {
      deltaSystolic,
      deltaDiastolic,
      positiveOrthostatic,
    };
  }, [lying, standing]);

  function reset() {
    setLying({ sys: "", dia: "", hr: "" });
    setSitting({ sys: "", dia: "", hr: "" });
    setStanding({ sys: "", dia: "", hr: "" });
  }

  function save() {
    const lie = buildReading(lying.sys, lying.dia, lying.hr);
    const sit = buildReading(sitting.sys, sitting.dia, sitting.hr);
    const st = buildReading(standing.sys, standing.dia, standing.hr);
    if (!lie || !sit || !st) return;
    const deltaSystolic = lie.systolic - st.systolic;
    const deltaDiastolic = lie.diastolic - st.diastolic;
    const positiveOrthostatic =
      deltaSystolic >= 20 || deltaDiastolic >= 10;

    const session: OrthostaticSession = {
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      lying: lie,
      sitting: sit,
      standing3m: st,
      standing: st,
      deltaSystolic,
      deltaDiastolic,
      positiveOrthostatic,
    };
    onSaveSession(session);
    reset();
  }

  const canSave =
    buildReading(lying.sys, lying.dia, lying.hr) &&
    buildReading(sitting.sys, sitting.dia, sitting.hr) &&
    buildReading(standing.sys, standing.dia, standing.hr);

  return (
    <section className="rounded-2xl border-2 border-amber-500/50 bg-black p-5 shadow-xl ring-2 ring-amber-500/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">
            Guided Orthostatic Test
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
            Lying (baseline) → sitting → standing. Deltas use{" "}
            <span className="font-medium text-amber-200">lying vs standing</span>{" "}
            as you type.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StageInputs
          title="Lying (baseline)"
          subtitle="After ~5 min supine, when ready."
          sys={lying.sys}
          dia={lying.dia}
          hr={lying.hr}
          onSys={(v) => setLying((p) => ({ ...p, sys: v }))}
          onDia={(v) => setLying((p) => ({ ...p, dia: v }))}
          onHr={(v) => setLying((p) => ({ ...p, hr: v }))}
        />
        <StageInputs
          title="Sitting"
          sys={sitting.sys}
          dia={sitting.dia}
          hr={sitting.hr}
          onSys={(v) => setSitting((p) => ({ ...p, sys: v }))}
          onDia={(v) => setSitting((p) => ({ ...p, dia: v }))}
          onHr={(v) => setSitting((p) => ({ ...p, hr: v }))}
        />
        <StageInputs
          title="Standing"
          subtitle="Final standing BP for this check."
          sys={standing.sys}
          dia={standing.dia}
          hr={standing.hr}
          onSys={(v) => setStanding((p) => ({ ...p, sys: v }))}
          onDia={(v) => setStanding((p) => ({ ...p, dia: v }))}
          onHr={(v) => setStanding((p) => ({ ...p, hr: v }))}
        />
      </div>

      {delta && (
        <div className="mt-6 rounded-xl border border-white/20 bg-zinc-950 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Delta (lying − standing)
          </p>
          <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-white">
            Δ Systolic: {delta.deltaSystolic} mmHg · Δ Diastolic:{" "}
            {delta.deltaDiastolic} mmHg
          </p>
          {delta.positiveOrthostatic ? (
            <div
              className="mt-4 space-y-3 rounded-lg border-2 border-red-500 bg-red-950/90 px-4 py-3"
              role="alert"
            >
              <p className="text-center text-base font-black uppercase tracking-wide text-red-100">
                POSITIVE FOR ORTHOSTATIC HYPOTENSION
              </p>
              <p className="text-center text-sm text-red-200/95">
                Systolic drop ≥ 20 mmHg and/or diastolic drop ≥ 10 mmHg vs lying.
                Discuss with your clinician.
              </p>
              <Link
                href="/journal"
                className="flex w-full items-center justify-center rounded-lg border-2 border-white/30 bg-black px-4 py-3 text-sm font-bold text-white hover:bg-zinc-900"
              >
                Log concurrent symptoms (dizziness, nausea…)
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              Threshold not met on BP numbers alone; still log symptoms if you feel
              faint or nauseated.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canSave}
          onClick={save}
          className="min-h-[48px] flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save orthostatic session
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
