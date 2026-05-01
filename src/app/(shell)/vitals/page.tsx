"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import GuidedOrthostaticCard from "@/components/GuidedOrthostaticCard";
import OrthostaticTracker from "@/components/OrthostaticTracker";
import PositionalDeltaChart from "@/components/vitals/PositionalDeltaChart";
import VitalsChart from "@/components/vitals/VitalsChart";
import { standing3mReading } from "@/lib/orthostatic-utils";
import { qk } from "@/lib/query-keys";
import type { OrthostaticSession, SwellingCheckEntry, VitalRow } from "@/lib/types";
import {
  EDEMA_LEVEL_TYPE,
  EDEMA_LEVEL_TYPE_LABELS,
  type EdemaLevelType,
} from "@/lib/edema-level-type";
import { useState } from "react";

export default function VitalsPage() {
  const qc = useQueryClient();
  const { data: vitals = [] } = useQuery({
    queryKey: qk.vitals,
    queryFn: async (): Promise<VitalRow[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: orthostatic = [] } = useQuery({
    queryKey: qk.orthostatic,
    queryFn: async (): Promise<OrthostaticSession[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: swellingChecks = [] } = useQuery({
    queryKey: qk.swellingChecks,
    queryFn: async (): Promise<SwellingCheckEntry[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const addVital = useMutation({
    mutationFn: async (v: VitalRow) => v,
    onSuccess: (row) => {
      qc.setQueryData<VitalRow[]>(qk.vitals, (prev = []) => [row, ...prev]);
    },
  });

  const addOrtho = useMutation({
    mutationFn: async (o: OrthostaticSession) => o,
    onSuccess: (session) => {
      qc.setQueryData<OrthostaticSession[]>(qk.orthostatic, (prev = []) => [
        session,
        ...prev,
      ]);
    },
  });

  const addSwelling = useMutation({
    mutationFn: async (row: SwellingCheckEntry) => row,
    onSuccess: (row) => {
      qc.setQueryData<SwellingCheckEntry[]>(qk.swellingChecks, (prev = []) => [
        row,
        ...prev,
      ]);
    },
  });

  const [edemaLevel, setEdemaLevel] = useState<EdemaLevelType>("none");
  const [swellingNotes, setSwellingNotes] = useState("");

  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [hr, setHr] = useState("");
  const [notes, setNotes] = useState("");

  function submitSpot(e: React.FormEvent) {
    e.preventDefault();
    const s = Number(sys);
    const d = Number(dia);
    const h = hr.trim() === "" ? undefined : Number(hr);
    if (Number.isNaN(s) || Number.isNaN(d)) return;
    addVital.mutate({
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      systolic: s,
      diastolic: d,
      heartRate: h !== undefined && !Number.isNaN(h) ? h : undefined,
      notes: notes.trim() || undefined,
    });
    setSys("");
    setDia("");
    setHr("");
    setNotes("");
  }

  function submitSwelling(e: React.FormEvent) {
    e.preventDefault();
    addSwelling.mutate({
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      edemaLevel,
      notes: swellingNotes.trim() || undefined,
    });
    setSwellingNotes("");
    setEdemaLevel("none");
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Vitals
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Log routine readings and guided orthostatic checks for clinic visits.
        </p>
      </header>

      <GuidedOrthostaticCard onSaveSession={(session) => addOrtho.mutate(session)} />

      <OrthostaticTracker
        onComplete={(session) => addOrtho.mutate(session)}
      />

      {orthostatic.length > 0 && standing3mReading(orthostatic[0]) && (
        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 ring-1 ring-white/5">
          <h2 className="text-lg font-semibold text-slate-50">
            Positional comparison (latest session)
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Systolic and diastolic by posture. Soft red band when lying → standing
            (3m) meets common orthostatic thresholds (≥20 mmHg systolic or ≥10 mmHg
            diastolic drop).
          </p>
          <div className="mt-4">
            <VitalsChart session={orthostatic[0]} />
          </div>

          <h3 className="mt-8 text-base font-semibold text-slate-200">
            Delta vs lying
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Change from lying at each position (reference: ≥20 mmHg systolic drop).
          </p>
          <div className="mt-4">
            <PositionalDeltaChart session={orthostatic[0]} />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 ring-1 ring-white/5">
        <h2 className="text-lg font-semibold text-slate-50">Swelling check</h2>
        <p className="mt-1 text-sm text-slate-400">
          Pitting depth uses your database{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-sky-200">
            edema_level_type
          </code>{" "}
          enum values.
        </p>
        <form onSubmit={submitSwelling} className="mt-4 space-y-4">
          <fieldset>
            <legend className="text-sm font-medium text-slate-300">
              Edema level
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {EDEMA_LEVEL_TYPE.map((value) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    edemaLevel === value
                      ? "border-sky-500/60 bg-sky-950/40 text-slate-50"
                      : "border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="edema_level_type"
                    value={value}
                    checked={edemaLevel === value}
                    onChange={() => setEdemaLevel(value)}
                    className="h-4 w-4 border-slate-500 text-sky-600 focus:ring-sky-500"
                  />
                  <span>{EDEMA_LEVEL_TYPE_LABELS[value]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Notes (optional)
            <input
              className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50"
              value={swellingNotes}
              onChange={(e) => setSwellingNotes(e.target.value)}
              placeholder="Location, symmetry, meds…"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-700 py-3 text-sm font-semibold text-white hover:bg-slate-600"
          >
            Save swelling check
          </button>
        </form>
        {swellingChecks.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-slate-800 pt-4">
            {swellingChecks.slice(0, 6).map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-400"
              >
                <span className="font-medium text-slate-200">
                  {EDEMA_LEVEL_TYPE_LABELS[s.edemaLevel]}
                </span>
                <time dateTime={s.recordedAt}>
                  {new Date(s.recordedAt).toLocaleString()}
                </time>
                {s.notes && (
                  <span className="w-full text-slate-500">{s.notes}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 ring-1 ring-white/5">
        <h2 className="text-lg font-semibold text-slate-50">Spot BP check</h2>
        <form onSubmit={submitSpot} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Systolic
              <input
                inputMode="numeric"
                className="w-28 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50"
                value={sys}
                onChange={(e) => setSys(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Diastolic
              <input
                inputMode="numeric"
                className="w-28 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              HR (optional)
              <input
                inputMode="numeric"
                className="w-28 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50"
                value={hr}
                onChange={(e) => setHr(e.target.value)}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Notes
            <input
              className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-50"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-700 py-3 text-sm font-semibold text-white hover:bg-slate-600"
          >
            Save reading
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Recent orthostatic sessions
        </h2>
        <ul className="mt-3 space-y-2">
          {orthostatic.length === 0 && (
            <li className="text-sm text-slate-500">None saved yet.</li>
          )}
          {orthostatic.slice(0, 8).map((o) => (
            <li
              key={o.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-slate-400">
                  {new Date(o.recordedAt).toLocaleString()}
                </span>
                {o.positiveOrthostatic ? (
                  <span className="font-semibold text-red-400">
                    Positive orthostatic screen
                  </span>
                ) : (
                  <span className="text-slate-500">Within common thresholds</span>
                )}
              </div>
              <p className="mt-2 font-mono text-slate-200">
                L {o.lying.systolic}/{o.lying.diastolic} · S{" "}
                {o.sitting.systolic}/{o.sitting.diastolic}
                {o.standing1m
                  ? ` · St1m ${o.standing1m.systolic}/${o.standing1m.diastolic}`
                  : ""}{" "}
                · St3m{" "}
                {standing3mReading(o)?.systolic ?? "—"}/
                {standing3mReading(o)?.diastolic ?? "—"}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-400">
                Δ {o.deltaSystolic} / {o.deltaDiastolic} mmHg (lying → standing)
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Recent BP readings
        </h2>
        <ul className="mt-3 space-y-2">
          {vitals.length === 0 && (
            <li className="text-sm text-slate-500">None saved yet.</li>
          )}
          {vitals.slice(0, 12).map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm"
            >
              <span className="font-mono text-slate-100">
                {v.systolic}/{v.diastolic}
                {v.heartRate != null ? ` · HR ${v.heartRate}` : ""}
              </span>
              <span className="text-slate-500">
                {new Date(v.recordedAt).toLocaleString()}
              </span>
              {v.notes && (
                <span className="w-full text-slate-400">{v.notes}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
