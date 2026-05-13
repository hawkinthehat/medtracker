"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { qk } from "@/lib/query-keys";
import type { VitalRow } from "@/lib/types";
import {
  insertHealthVital,
  type HealthVitalPosition,
  type InsertHealthVitalInput,
} from "@/lib/supabase/health-vitals";
import { toastMessageForPersistFailure } from "@/lib/supabase/auth-save-guard";

type QuickBpHomeButtonProps = {
  /** True when Supabase is configured and the user is signed in (enables Save to `health_vitals`). */
  canSave: boolean;
};

const POSITIONS: {
  value: HealthVitalPosition;
  label: string;
  emoji: string;
}[] = [
  { value: "lying", label: "Lying", emoji: "🛌" },
  { value: "sitting", label: "Sitting", emoji: "🪑" },
  { value: "standing", label: "Standing", emoji: "🧍" },
];

export default function QuickBpHomeButton({ canSave }: QuickBpHomeButtonProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [hr, setHr] = useState("");
  const [position, setPosition] = useState<HealthVitalPosition>("sitting");
  const [formError, setFormError] = useState<string | null>(null);
  const [loggedAck, setLoggedAck] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedAck) return;
    const t = window.setTimeout(() => setLoggedAck(false), 2600);
    return () => window.clearTimeout(t);
  }, [loggedAck]);

  useEffect(() => {
    if (!saveError) return;
    const t = window.setTimeout(() => setSaveError(null), 5000);
    return () => window.clearTimeout(t);
  }, [saveError]);

  const saveMutation = useMutation({
    mutationFn: async (input: InsertHealthVitalInput) => {
      const res = await insertHealthVital(input);
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.vitals });
      const previous = qc.getQueryData<VitalRow[]>(qk.vitals) ?? [];
      const optimistic: VitalRow = {
        id: input.id ?? crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        systolic: Math.round(input.systolic),
        diastolic: Math.round(input.diastolic),
        heartRate:
          input.heartRate != null && Number.isFinite(input.heartRate)
            ? Math.round(Number(input.heartRate))
            : undefined,
        notes: `Quick BP · ${input.position}`,
      };
      qc.setQueryData<VitalRow[]>(qk.vitals, [optimistic, ...previous]);
      return { previous };
    },
    onError: (err: unknown, _input, ctx) => {
      setLoggedAck(false);
      if (ctx?.previous) qc.setQueryData(qk.vitals, ctx.previous);
      const raw = err instanceof Error ? err.message : "Save failed";
      setSaveError(toastMessageForPersistFailure(raw));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.vitals });
    },
  });

  function resetForm() {
    setSys("");
    setDia("");
    setHr("");
    setPosition("sitting");
    setFormError(null);
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  function submit() {
    if (!canSave) {
      setFormError("Sign in to save this reading to your chart.");
      return;
    }
    setFormError(null);
    const s = Number.parseInt(sys.trim(), 10);
    const d = Number.parseInt(dia.trim(), 10);
    if (!Number.isFinite(s) || s < 40 || s > 280) {
      setFormError("Enter a valid systolic (40–280).");
      return;
    }
    if (!Number.isFinite(d) || d < 30 || d > 200) {
      setFormError("Enter a valid diastolic (30–200).");
      return;
    }
    if (s <= d) {
      setFormError("Systolic should be greater than diastolic.");
      return;
    }

    const hrTrim = hr.trim();
    let heartRate: number | null | undefined;
    if (hrTrim !== "") {
      const h = Number.parseInt(hrTrim, 10);
      if (!Number.isFinite(h) || h < 30 || h > 240) {
        setFormError("Heart rate should be 30–240 bpm or empty.");
        return;
      }
      heartRate = h;
    }

    const id = crypto.randomUUID();
    closeModal();
    setLoggedAck(true);

    saveMutation.mutate({
      id,
      systolic: s,
      diastolic: d,
      position,
      heartRate: heartRate ?? null,
    });
  }

  const modal =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-3 sm:items-center"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
        onTouchStart={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-bp-title"
          className="w-full max-w-md rounded-2xl border-4 border-black bg-white p-4 shadow-2xl sm:p-5"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <h2
            id="quick-bp-title"
            className="text-xl font-black tracking-tight text-black"
          >
            Quick BP
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            Systolic / diastolic (mmHg), posture (lying / sitting / standing),
            optional pulse. Saved to{" "}
            <span className="font-bold text-slate-900">health_vitals</span> when
            you are signed in.
          </p>
          {!canSave && (
            <p className="mt-3 rounded-lg border-2 border-amber-700 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">
              Sign in with Supabase to save readings. You can still preview the
              form below.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="flex flex-1 min-w-[5rem] flex-col gap-1">
              <span className="text-xs font-black uppercase tracking-wide text-black">
                Systolic
              </span>
              <input
                inputMode="numeric"
                value={sys}
                onChange={(e) => setSys(e.target.value.replace(/\D/g, ""))}
                className="rounded-xl border-4 border-black bg-white px-3 py-2 font-mono text-lg font-black text-black outline-none ring-0 focus:bg-slate-50"
                placeholder="110"
                autoComplete="off"
              />
            </label>
            <span
              className="pb-2 text-2xl font-black text-black"
              aria-hidden
            >
              /
            </span>
            <label className="flex flex-1 min-w-[5rem] flex-col gap-1">
              <span className="text-xs font-black uppercase tracking-wide text-black">
                Diastolic
              </span>
              <input
                inputMode="numeric"
                value={dia}
                onChange={(e) => setDia(e.target.value.replace(/\D/g, ""))}
                className="rounded-xl border-4 border-black bg-white px-3 py-2 font-mono text-lg font-black text-black outline-none focus:bg-slate-50"
                placeholder="70"
                autoComplete="off"
              />
            </label>
          </div>

          <p className="mt-4 text-xs font-black uppercase tracking-wide text-black">
            Position
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPosition(p.value)}
                className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl border-4 px-1 py-2 text-center font-black transition ${
                  position === p.value
                    ? "border-black bg-black text-white"
                    : "border-black bg-white text-black hover:bg-slate-100"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {p.emoji}
                </span>
                <span className="text-[11px] font-black uppercase leading-tight">
                  {p.label}
                </span>
              </button>
            ))}
          </div>

          <label className="mt-4 flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-black">
              Heart rate (optional, bpm)
            </span>
            <input
              inputMode="numeric"
              value={hr}
              onChange={(e) => setHr(e.target.value.replace(/\D/g, ""))}
              className="rounded-xl border-4 border-black bg-white px-3 py-2 font-mono text-lg font-black text-black outline-none focus:bg-slate-50"
              placeholder="—"
              autoComplete="off"
            />
          </label>

          {formError && (
            <p className="mt-3 text-sm font-bold text-red-800">{formError}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="min-h-[48px] flex-1 rounded-xl border-4 border-black bg-white px-4 text-base font-black text-black transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSave || saveMutation.isPending}
              className="min-h-[48px] flex-1 rounded-xl border-4 border-black bg-black px-4 text-base font-black text-white transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Log a quick blood pressure reading"
        className="inline-flex min-h-[48px] min-w-[5.5rem] items-center justify-center rounded-xl border-4 border-black bg-white px-3 text-base font-black tracking-tight text-black shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
      >
        ➕ BP
      </button>
      {loggedAck && (
        <span
          className="flex items-center gap-1 rounded-lg border-2 border-emerald-800 bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-950"
          role="status"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
          Logged
        </span>
      )}
      {saveError && (
        <p className="max-w-[12rem] text-right text-xs font-bold text-red-800">
          {saveError}
        </p>
      )}

      {modal}
    </div>
  );
}
