"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import { qk } from "@/lib/query-keys";
import type { VitalRow } from "@/lib/types";
import type { HealthVitalPosition } from "@/lib/supabase/health-vitals";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type QuickBpHomeButtonProps = {
  /** Runs after a successful BP save — e.g. refresh `daily_logs` hydration totals (never awaits weather). */
  onAfterSuccessfulSave?: () => void;
};

function formatBpSaveFailure(errorMessage: string): string {
  const m = errorMessage.toLowerCase();
  if (
    errorMessage === "not_signed_in" ||
    m.includes("jwt expired") ||
    m.includes("invalid jwt") ||
    m.includes("auth session missing") ||
    m.includes("refresh token") ||
    m.includes("session expired") ||
    (m.includes("foreign key") &&
      (m.includes("user_id") || m.includes("daily_logs_user_id")))
  ) {
    return "Session expired. Please log in again to save your progress.";
  }
  return errorMessage;
}

const POSITIONS: {
  value: HealthVitalPosition;
  label: string;
  emoji: string;
}[] = [
  { value: "lying", label: "Lying", emoji: "🛌" },
  { value: "sitting", label: "Sitting", emoji: "🪑" },
  { value: "standing", label: "Standing", emoji: "🧍" },
];

export default function QuickBpHomeButton({
  onAfterSuccessfulSave,
}: QuickBpHomeButtonProps) {
  const qc = useQueryClient();
  const router = useRouter();
  const sb = getSupabaseBrowserClient();
  const supabaseConfigured = Boolean(sb);

  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);

  const [open, setOpen] = useState(false);
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [hr, setHr] = useState("");
  const [position, setPosition] = useState<HealthVitalPosition>("sitting");
  const [formError, setFormError] = useState<string | null>(null);
  const [loggedAck, setLoggedAck] = useState(false);
  const [saving, setSaving] = useState(false);

  const needsSignIn =
    supabaseConfigured && sessionResolved && !sessionUser;

  useEffect(() => {
    if (!sb) {
      setSessionUser(null);
      setSessionResolved(true);
      return;
    }
    void sb.auth.getUser().then(({ data: { user } }) => {
      setSessionUser(user ?? null);
      setSessionResolved(true);
    });
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(async () => {
      const {
        data: { user },
      } = await sb.auth.getUser();
      setSessionUser(user ?? null);
      setSessionResolved(true);
    });
    return () => subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (!loggedAck) return;
    const t = window.setTimeout(() => setLoggedAck(false), 3200);
    return () => window.clearTimeout(t);
  }, [loggedAck]);

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
    console.log("[QuickBP] submit() fired");
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
    let heartRate: number | null = null;
    if (hrTrim !== "") {
      const h = Number.parseInt(hrTrim, 10);
      if (!Number.isFinite(h) || h < 30 || h > 240) {
        setFormError("Heart rate should be 30–240 bpm or empty.");
        return;
      }
      heartRate = h;
    }

    if (!sb) {
      setFormError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const id = crypto.randomUUID();
    const recordedAt = new Date().toISOString();
    const previous = qc.getQueryData<VitalRow[]>(qk.vitals) ?? [];
    const optimistic: VitalRow = {
      id,
      recordedAt,
      systolic: Math.round(s),
      diastolic: Math.round(d),
      heartRate:
        heartRate != null && Number.isFinite(heartRate)
          ? Math.round(heartRate)
          : undefined,
      notes: `Quick BP · ${position}`,
    };
    void qc.cancelQueries({ queryKey: qk.vitals });
    qc.setQueryData<VitalRow[]>(qk.vitals, [optimistic, ...previous]);

    setSaving(true);

    void (async () => {
      try {
        const client = getSupabaseBrowserClient();
        if (!client) {
          qc.setQueryData(qk.vitals, previous);
          setFormError("Supabase is not configured.");
          return;
        }

        const {
          data: { user },
        } = await client.auth.getUser();
        if (!user?.id) {
          qc.setQueryData(qk.vitals, previous);
          setFormError(formatBpSaveFailure("not_signed_in"));
          return;
        }

        const pulse =
          heartRate != null && Number.isFinite(heartRate)
            ? Math.round(heartRate)
            : null;

        const payload = {
          id,
          user_id: user.id,
          recorded_at: recordedAt,
          systolic: Math.round(s),
          diastolic: Math.round(d),
          pulse,
          position,
        };
        console.log("BP Payload:", payload);

        const { error } = await client.from("health_vitals").insert(payload);

        if (error) {
          console.warn("[QuickBP] health_vitals insert:", error.message);
          qc.setQueryData(qk.vitals, previous);
          setFormError(formatBpSaveFailure(error.message));
          return;
        }

        try {
          window.alert("BP Logged!");
        } catch {
          /* blocked by browser / in-app webview */
        }

        closeModal();
        setLoggedAck(true);
        void qc.invalidateQueries({ queryKey: qk.vitals });
        try {
          onAfterSuccessfulSave?.();
        } catch (e) {
          console.warn("[QuickBP] onAfterSuccessfulSave failed (non-fatal):", e);
        }
        router.refresh();
      } catch (e) {
        console.warn("[QuickBP] save:", e);
        qc.setQueryData(qk.vitals, previous);
        setFormError(
          formatBpSaveFailure(
            e instanceof Error ? e.message : "Save failed",
          ),
        );
      } finally {
        setSaving(false);
      }
    })();
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
            Systolic / diastolic (mmHg), posture, optional pulse. Inserts use{" "}
            <span className="font-bold text-slate-900">
              recorded_at, systolic, diastolic, pulse
            </span>{" "}
            on <span className="font-bold text-slate-900">health_vitals</span>.
          </p>
          {!supabaseConfigured && sessionResolved && (
            <p className="mt-3 rounded-lg border-2 border-amber-700 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">
              Supabase env vars are missing — readings cannot be saved to the
              cloud.
            </p>
          )}
          {needsSignIn && (
            <p className="mt-3 rounded-lg border-2 border-amber-700 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">
              Sign in with Supabase to save readings. You can still preview the
              form below.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="flex min-w-[5rem] flex-1 flex-col gap-1">
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
            <label className="flex min-w-[5rem] flex-1 flex-col gap-1">
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
                className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl border-4 px-1 py-2 text-center font-black transition touch-manipulation ${
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

          {/*
            DEBUG handshake: no native <form> submit, no input `required` (mobile
            browsers can block taps with no visible reason). Save stays enabled so
            submit() always runs and console shows validation / payload / Supabase.
          */}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="min-h-[52px] flex-1 touch-manipulation rounded-xl border-4 border-black bg-white px-4 text-base font-black text-black transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                submit();
              }}
              className="min-h-[52px] flex-1 touch-manipulation rounded-xl border-4 border-black bg-black px-4 text-base font-black text-white transition hover:bg-neutral-900"
            >
              {saving ? "Saving…" : "Save"}
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
        className="inline-flex min-h-[48px] min-w-[5.5rem] touch-manipulation items-center justify-center rounded-xl border-4 border-black bg-white px-3 text-base font-black tracking-tight text-black shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
      >
        ➕ BP
      </button>
      {loggedAck && (
        <span
          className="flex items-center gap-1 rounded-lg border-2 border-emerald-800 bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-950"
          role="status"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
          Saved
        </span>
      )}

      {modal}
    </div>
  );
}
