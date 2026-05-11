"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import GuidedOrthostaticCard from "@/components/GuidedOrthostaticCard";
import OrthostaticTracker from "@/components/OrthostaticTracker";
import PositionalDeltaChart from "@/components/vitals/PositionalDeltaChart";
import VitalsChart from "@/components/vitals/VitalsChart";
import VitalsLyingStandingQuickPair from "@/components/vitals/VitalsLyingStandingQuickPair";
import { standing3mReading } from "@/lib/orthostatic-utils";
import { qk } from "@/lib/query-keys";
import type { OrthostaticSession, SwellingCheckEntry, VitalRow } from "@/lib/types";
import {
  EDEMA_LEVEL_TYPE,
  EDEMA_LEVEL_TYPE_LABELS,
  type EdemaLevelType,
} from "@/lib/edema-level-type";
import {
  TOAST_ACTIVE_STAND,
  TOAST_SWELLING,
  TOAST_VITALS_PAIR,
} from "@/lib/educational-toasts";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { persistVitalToSupabase } from "@/lib/supabase/vitals";

export default function VitalsPage() {
  const qc = useQueryClient();
  const [vitalsToast, setVitalsToast] = useState<string | null>(null);

  useEffect(() => {
    if (!vitalsToast) return;
    const t = window.setTimeout(() => setVitalsToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [vitalsToast]);
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

  const saveLyingStandingPair = useMutation({
    mutationFn: async (pair: { lying: VitalRow; standing: VitalRow }) => {
      const sb = getSupabaseBrowserClient();
      if (sb) {
        const okL = await persistVitalToSupabase(pair.lying);
        const okS = await persistVitalToSupabase(pair.standing);
        if (!okL || !okS) {
          throw new Error("Could not save vitals — check Supabase.");
        }
      }
      return pair;
    },
    onSuccess: ({ lying, standing }) => {
      qc.setQueryData<VitalRow[]>(qk.vitals, (prev = []) => [
        standing,
        lying,
        ...prev,
      ]);
      setVitalsToast(TOAST_VITALS_PAIR);
      setLieSys("");
      setLieDia("");
      setLieHr("");
      setStandSys("");
      setStandDia("");
      setStandHr("");
      setPairNotes("");
      setCompressionGear(false);
    },
  });

  const addOrtho = useMutation({
    mutationFn: async (o: OrthostaticSession) => o,
    onSuccess: (session) => {
      qc.setQueryData<OrthostaticSession[]>(qk.orthostatic, (prev = []) => [
        session,
        ...prev,
      ]);
      setVitalsToast(TOAST_ACTIVE_STAND);
    },
  });

  const addSwelling = useMutation({
    mutationFn: async (row: SwellingCheckEntry) => row,
    onSuccess: (row) => {
      qc.setQueryData<SwellingCheckEntry[]>(qk.swellingChecks, (prev = []) => [
        row,
        ...prev,
      ]);
      setVitalsToast(TOAST_SWELLING);
    },
  });

  const [edemaLevel, setEdemaLevel] = useState<EdemaLevelType>("none");
  const [swellingNotes, setSwellingNotes] = useState("");

  const [lieSys, setLieSys] = useState("");
  const [lieDia, setLieDia] = useState("");
  const [lieHr, setLieHr] = useState("");
  const [standSys, setStandSys] = useState("");
  const [standDia, setStandDia] = useState("");
  const [standHr, setStandHr] = useState("");
  const [compressionGear, setCompressionGear] = useState(false);
  const [pairNotes, setPairNotes] = useState("");

  const lyingParsed = useMemo(() => {
    const s = Number(lieSys);
    const d = Number(lieDia);
    if (Number.isNaN(s) || Number.isNaN(d)) return null;
    const hRaw = lieHr.trim();
    const h = hRaw === "" ? undefined : Number(hRaw);
    if (h !== undefined && Number.isNaN(h)) return null;
    return { systolic: s, diastolic: d, heartRate: h };
  }, [lieSys, lieDia, lieHr]);

  const standingParsed = useMemo(() => {
    const s = Number(standSys);
    const d = Number(standDia);
    if (Number.isNaN(s) || Number.isNaN(d)) return null;
    const hRaw = standHr.trim();
    const h = hRaw === "" ? undefined : Number(hRaw);
    if (h !== undefined && Number.isNaN(h)) return null;
    return { systolic: s, diastolic: d, heartRate: h };
  }, [standSys, standDia, standHr]);

  const deltaSummary = useMemo(() => {
    if (!lyingParsed || !standingParsed) return null;
    const dSys = lyingParsed.systolic - standingParsed.systolic;
    const dDia = lyingParsed.diastolic - standingParsed.diastolic;
    let hrLine: string | null = null;
    if (
      lyingParsed.heartRate != null &&
      standingParsed.heartRate != null
    ) {
      const dHr = standingParsed.heartRate - lyingParsed.heartRate;
      const sign = dHr > 0 ? "+" : "";
      hrLine = `Δ HR (standing − lying): ${sign}${dHr} BPM`;
    }
    const sysSign = dSys > 0 ? "+" : "";
    const diaSign = dDia > 0 ? "+" : "";
    return {
      dSys,
      dDia,
      sysLine: `Δ Systolic (lying − standing): ${sysSign}${dSys} mmHg`,
      diaLine: `Δ Diastolic (lying − standing): ${diaSign}${dDia} mmHg`,
      hrLine,
    };
  }, [lyingParsed, standingParsed]);

  function submitLyingStanding(e: React.FormEvent) {
    e.preventDefault();
    if (!lyingParsed || !standingParsed) return;
    const recordedAt = new Date().toISOString();
    const pairId = crypto.randomUUID();
    const baseUser = pairNotes.trim();
    const line = (posture: "lying" | "standing") =>
      [
        baseUser || undefined,
        `Paired orthostatic quick check · ${posture}`,
        `pair_id:${pairId}`,
      ]
        .filter(Boolean)
        .join("\n");

    const lying: VitalRow = {
      id: crypto.randomUUID(),
      recordedAt,
      systolic: lyingParsed.systolic,
      diastolic: lyingParsed.diastolic,
      heartRate: lyingParsed.heartRate,
      notes: line("lying"),
      compressionGarment: compressionGear,
    };
    const standing: VitalRow = {
      id: crypto.randomUUID(),
      recordedAt,
      systolic: standingParsed.systolic,
      diastolic: standingParsed.diastolic,
      heartRate: standingParsed.heartRate,
      notes: line("standing"),
      compressionGarment: compressionGear,
    };
    saveLyingStandingPair.mutate({ lying, standing });
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
      {vitalsToast && (
        <p
          className="rounded-2xl border-4 border-emerald-800 bg-emerald-50 px-4 py-4 text-center text-[18px] font-semibold leading-snug text-emerald-950 shadow-sm"
          role="status"
          aria-live="polite"
        >
          {vitalsToast}
        </p>
      )}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Vitals
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          <strong className="text-slate-900">Default:</strong> guided lying →
          standing check first, then the quick pair if you want two linked rows in{" "}
          <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">vitals_readings</code>
          . Optional extended timed stand lives in the collapsible section under your
          charts.
        </p>
      </header>

      <section className="rounded-2xl border-2 border-sky-900 bg-sky-50 p-4 text-sm font-semibold leading-snug text-slate-900 ring-1 ring-sky-200">
        <strong className="text-base text-slate-950">Dysautonomia-first layout:</strong>{" "}
        Tiaki surfaces the guided orthostatic card and quick lying/standing pair
        before swelling and history so the screen matches how many clinics run a
        visit.
      </section>

      <GuidedOrthostaticCard onSaveSession={(session) => addOrtho.mutate(session)} />

      <VitalsLyingStandingQuickPair
        lieSys={lieSys}
        setLieSys={setLieSys}
        lieDia={lieDia}
        setLieDia={setLieDia}
        lieHr={lieHr}
        setLieHr={setLieHr}
        standSys={standSys}
        setStandSys={setStandSys}
        standDia={standDia}
        setStandDia={setStandDia}
        standHr={standHr}
        setStandHr={setStandHr}
        compressionGear={compressionGear}
        setCompressionGear={setCompressionGear}
        pairNotes={pairNotes}
        setPairNotes={setPairNotes}
        deltaSummary={deltaSummary}
        lyingParsed={lyingParsed}
        standingParsed={standingParsed}
        saveLyingStandingPair={saveLyingStandingPair}
        onSubmit={submitLyingStanding}
      />

      {orthostatic.length > 0 && standing3mReading(orthostatic[0]) && (
        <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-900">
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

          <h3 className="mt-8 text-base font-semibold text-slate-800">
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

      <details className="group rounded-2xl border border-slate-300 bg-white/98 ring-1 ring-slate-200/60 open:shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-4 text-lg font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
          Optional: timed active stand / extended orthostatic flow
        </summary>
        <div className="border-t border-slate-200 px-4 pb-4 pt-2">
          <OrthostaticTracker
            onComplete={(session) => addOrtho.mutate(session)}
          />
        </div>
      </details>

      <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-900">Swelling check</h2>
        <p className="mt-1 text-sm text-slate-400">
          Pitting depth uses your database{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs text-sky-200">
            edema_level_type
          </code>{" "}
          enum values.
        </p>
        <form onSubmit={submitSwelling} className="mt-4 space-y-4">
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">
              Edema level
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {EDEMA_LEVEL_TYPE.map((value) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    edemaLevel === value
                      ? "border-sky-500/60 bg-sky-950/40 text-slate-900"
                      : "border-slate-300 bg-slate-100/80 text-slate-700 hover:border-slate-300"
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
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Notes (optional)
            <input
              className="rounded-lg border border-slate-300 bg-gray-50 px-3 py-2 text-slate-900"
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
          <ul className="mt-4 space-y-2 border-t border-slate-200 pt-4">
            {swellingChecks.slice(0, 6).map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-400"
              >
                <span className="font-medium text-slate-800">
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
              className="rounded-xl border border-slate-200 bg-slate-50/95 px-3 py-3 text-sm"
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
              <p className="mt-2 font-mono text-slate-800">
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
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/95 px-3 py-2 text-sm"
            >
              <span className="font-mono text-slate-900">
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
