"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { qk } from "@/lib/query-keys";
import type { BpHrReading, OrthostaticSession } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { TOAST_ACTIVE_STAND } from "@/lib/educational-toasts";

const STAND_SECONDS = 120;

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
    systolic: Math.round(s),
    diastolic: Math.round(d),
    ...(h !== undefined ? { heartRate: Math.round(h) } : {}),
  };
}

export default function MorningOrthostaticVitalCheck() {
  const qc = useQueryClient();
  const sbOk = Boolean(getSupabaseBrowserClient());

  const [phase, setPhase] = useState<"idle" | "timers" | "standing">("idle");
  const [lying, setLying] = useState({ sys: "", dia: "", hr: "" });
  const [standing, setStanding] = useState({ sys: "", dia: "", hr: "" });
  const [remain, setRemain] = useState(STAND_SECONDS);
  const [compressionYes, setCompressionYes] = useState(false);
  const [binderYes, setBinderYes] = useState(false);
  const [sessionToast, setSessionToast] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "timers") return;
    const id = window.setInterval(() => {
      setRemain((r) => {
        if (r <= 1) {
          window.queueMicrotask(() => setPhase("standing"));
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const lieRead = useMemo(
    () => buildReading(lying.sys, lying.dia, lying.hr),
    [lying],
  );
  const standRead = useMemo(
    () => buildReading(standing.sys, standing.dia, standing.hr),
    [standing],
  );

  const preview = useMemo(() => {
    if (!lieRead || !standRead) return null;
    const deltaSystolic = lieRead.systolic - standRead.systolic;
    const deltaDiastolic = lieRead.diastolic - standRead.diastolic;
    const positiveOrthostatic =
      deltaSystolic >= 20 || deltaDiastolic >= 10;
    let potsSuspect = false;
    if (
      lieRead.heartRate != null &&
      standRead.heartRate != null
    ) {
      potsSuspect = standRead.heartRate - lieRead.heartRate > 30;
    }
    return {
      deltaSystolic,
      deltaDiastolic,
      positiveOrthostatic,
      potsSuspect,
      hrDelta:
        lieRead.heartRate != null && standRead.heartRate != null
          ? standRead.heartRate - lieRead.heartRate
          : null,
    };
  }, [lieRead, standRead]);

  const saveOrtho = useMutation({
    mutationFn: async (session: OrthostaticSession) => session,
    onSuccess: (session) => {
      qc.setQueryData<OrthostaticSession[]>(qk.orthostatic, (prev = []) => [
        session,
        ...prev,
      ]);
      setSessionToast(TOAST_ACTIVE_STAND);
      window.setTimeout(() => setSessionToast(null), 4500);
    },
  });

  function startTimer() {
    const lie = buildReading(lying.sys, lying.dia, lying.hr);
    if (!lie) return;
    setRemain(STAND_SECONDS);
    setPhase("timers");
  }

  function saveSession() {
    const lie = buildReading(lying.sys, lying.dia, lying.hr);
    const st = buildReading(standing.sys, standing.dia, standing.hr);
    if (!lie || !st) return;
    const deltaSystolic = lie.systolic - st.systolic;
    const deltaDiastolic = lie.diastolic - st.diastolic;
    const positiveOrthostatic =
      deltaSystolic >= 20 || deltaDiastolic >= 10;
    let potsSuspect = false;
    if (lie.heartRate != null && st.heartRate != null) {
      potsSuspect = st.heartRate - lie.heartRate > 30;
    }

    const session: OrthostaticSession = {
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      lying: lie,
      sitting: lie,
      standing3m: st,
      standing: st,
      deltaSystolic,
      deltaDiastolic,
      positiveOrthostatic,
      potsSuspect,
      compressionGarment: compressionYes,
      abdominalBinder: binderYes,
    };
    saveOrtho.mutate(session);
    setPhase("idle");
    setLying({ sys: "", dia: "", hr: "" });
    setStanding({ sys: "", dia: "", hr: "" });
    setCompressionYes(false);
    setBinderYes(false);
  }

  const mm = Math.floor(remain / 60);
  const ss = remain % 60;
  const inputCls =
    "min-h-[56px] w-full max-w-[11rem] rounded-xl border-4 border-black bg-white px-3 text-2xl font-black tabular-nums text-slate-900";

  return (
    <div className="rounded-2xl border-4 border-indigo-700 bg-indigo-50 p-5 shadow-md">
      {sessionToast && (
        <p
          className="mb-4 rounded-xl border-4 border-emerald-800 bg-emerald-50 px-4 py-3 text-center text-[18px] font-semibold leading-snug text-emerald-950"
          role="status"
        >
          {sessionToast}
        </p>
      )}
      <div className="flex items-start gap-3">
        <Activity
          className="h-10 w-10 shrink-0 text-indigo-800"
          aria-hidden
        />
        <div>
          <h3 className="text-2xl font-black text-slate-900">
            Orthostatic vital check
          </h3>
          <p className="mt-1 text-base font-semibold text-slate-800">
            Lie → stand 2 minutes → stand BP &amp; HR. Tiaki flags big BP drops
            or HR jumps for your doctor PDF.
          </p>
        </div>
      </div>

      {phase === "idle" && (
        <div className="mt-6 space-y-5">
          <p className="text-center text-lg font-black uppercase tracking-wide text-slate-900">
            Step 1 · Lying down
          </p>
          <div className="flex flex-wrap gap-4">
            <label className="block">
              <span className="text-lg font-bold text-slate-900">Systolic</span>
              <input
                className={`mt-2 ${inputCls}`}
                inputMode="numeric"
                value={lying.sys}
                onChange={(e) =>
                  setLying((p) => ({ ...p, sys: e.target.value }))
                }
                aria-label="Lying systolic"
              />
            </label>
            <label className="block">
              <span className="text-lg font-bold text-slate-900">
                Diastolic
              </span>
              <input
                className={`mt-2 ${inputCls}`}
                inputMode="numeric"
                value={lying.dia}
                onChange={(e) =>
                  setLying((p) => ({ ...p, dia: e.target.value }))
                }
                aria-label="Lying diastolic"
              />
            </label>
            <label className="block">
              <span className="text-lg font-bold text-slate-900">
                Heart rate
              </span>
              <input
                className={`mt-2 ${inputCls}`}
                inputMode="numeric"
                value={lying.hr}
                onChange={(e) =>
                  setLying((p) => ({ ...p, hr: e.target.value }))
                }
                aria-label="Lying heart rate"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!lieRead}
            onClick={startTimer}
            className="min-h-[72px] w-full rounded-2xl border-4 border-black bg-indigo-600 py-4 text-2xl font-black uppercase tracking-wide text-white shadow-lg disabled:opacity-40"
          >
            Measure lying down — start 2-minute timer
          </button>
        </div>
      )}

      {phase === "timers" && remain > 0 && (
        <div className="mt-8 text-center">
          <p className="text-xl font-black uppercase tracking-wide text-slate-900">
            Step 2 · Stand quietly
          </p>
          <p
            className="mt-6 font-mono text-7xl font-black tabular-nums text-indigo-900"
            aria-live="polite"
          >
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </p>
          <p className="mt-4 text-lg font-bold text-slate-800">
            Stay standing until the timer finishes.
          </p>
        </div>
      )}

      {phase === "standing" && (
        <div className="mt-8 space-y-6">
          <p className="text-center text-lg font-black uppercase tracking-wide text-slate-900">
            Step 3 · Standing measurements
          </p>

          <div className="rounded-2xl border-4 border-black bg-white p-4">
            <p className="text-lg font-black text-slate-900">Gear right now</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-base font-bold text-slate-800">
                  Wearing compression?
                </p>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCompressionYes(true)}
                    className={`min-h-[56px] flex-1 rounded-2xl border-4 border-black text-lg font-black ${
                      compressionYes
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-900"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompressionYes(false)}
                    className={`min-h-[56px] flex-1 rounded-2xl border-4 border-black text-lg font-black ${
                      !compressionYes
                        ? "bg-slate-700 text-white"
                        : "bg-white text-slate-900"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
              <div>
                <p className="text-base font-bold text-slate-800">
                  Abdominal binder?
                </p>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setBinderYes(true)}
                    className={`min-h-[56px] flex-1 rounded-2xl border-4 border-black text-lg font-black ${
                      binderYes
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-900"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setBinderYes(false)}
                    className={`min-h-[56px] flex-1 rounded-2xl border-4 border-black text-lg font-black ${
                      !binderYes
                        ? "bg-slate-700 text-white"
                        : "bg-white text-slate-900"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="block">
              <span className="text-lg font-bold text-slate-900">Systolic</span>
              <input
                className={`mt-2 ${inputCls}`}
                inputMode="numeric"
                value={standing.sys}
                onChange={(e) =>
                  setStanding((p) => ({ ...p, sys: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="text-lg font-bold text-slate-900">
                Diastolic
              </span>
              <input
                className={`mt-2 ${inputCls}`}
                inputMode="numeric"
                value={standing.dia}
                onChange={(e) =>
                  setStanding((p) => ({ ...p, dia: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="text-lg font-bold text-slate-900">
                Heart rate
              </span>
              <input
                className={`mt-2 ${inputCls}`}
                inputMode="numeric"
                value={standing.hr}
                onChange={(e) =>
                  setStanding((p) => ({ ...p, hr: e.target.value }))
                }
              />
            </label>
          </div>

          {preview &&
            (preview.positiveOrthostatic || preview.potsSuspect) && (
              <div
                className="rounded-2xl border-4 border-red-700 bg-red-50 px-4 py-5 text-center"
                role="alert"
              >
                <p className="text-2xl font-black uppercase tracking-wide text-red-900">
                  Flagged for doctor report
                </p>
                <p className="mt-3 text-lg font-bold leading-snug text-red-950">
                  {preview.positiveOrthostatic &&
                    "Blood pressure drop meets orthostatic hypotension screening (≥20 systolic and/or ≥10 diastolic mmHg vs lying). "}
                  {preview.potsSuspect &&
                    "Heart rate rise &gt;30 BPM lying → standing (common POTS cue). "}
                </p>
              </div>
            )}

          <button
            type="button"
            disabled={!standRead || saveOrtho.isPending}
            onClick={saveSession}
            className="min-h-[72px] w-full rounded-2xl border-4 border-black bg-sky-600 py-4 text-2xl font-black uppercase tracking-wide text-white shadow-lg disabled:opacity-40"
          >
            {saveOrtho.isPending ? "Saving…" : "Save orthostatic check"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setRemain(STAND_SECONDS);
            }}
            className="min-h-[56px] w-full rounded-2xl border-4 border-slate-500 bg-white text-lg font-bold text-slate-900"
          >
            Cancel
          </button>
        </div>
      )}

      {!sbOk && (
        <p className="mt-4 rounded-xl border-2 border-amber-600 bg-amber-50 p-3 text-base font-semibold text-amber-950">
          Orthostatic sessions stay on this device until Supabase is connected;
          doctor PDF uses what&apos;s in memory after you save.
        </p>
      )}
    </div>
  );
}
