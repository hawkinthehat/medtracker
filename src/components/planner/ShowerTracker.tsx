"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShowerHead } from "lucide-react";
import { qk } from "@/lib/query-keys";
import type { DailyLogEntry } from "@/lib/types";
import { persistDailyLogToSupabase } from "@/lib/supabase/daily-logs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toastShowerCheck } from "@/lib/educational-toasts";

const FEELINGS = ["Fine", "Dizzy", "Fainted", "Flare"] as const;

export default function ShowerTracker() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

  const [afterToast, setAfterToast] = useState<string | null>(null);

  const saveFeeling = useMutation({
    mutationFn: async (feeling: (typeof FEELINGS)[number]) => {
      const recordedAt = new Date().toISOString();
      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt,
        category: "activity",
        label: "Shower check-in",
        notes: `How do you feel? ${feeling}`,
      };
      if (supabaseConfigured) {
        const ok = await persistDailyLogToSupabase(row);
        if (!ok) throw new Error("Could not save — check Supabase.");
      }
      return row;
    },
    onSuccess: (row, feeling) => {
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
      setOpen(false);
      setAfterToast(toastShowerCheck(feeling));
      window.setTimeout(() => setAfterToast(null), 4500);
    },
  });

  const modal =
    mounted &&
    open &&
    createPortal(
      <div
        className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 p-3 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shower-feel-title"
      >
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border-4 border-black bg-white p-6 shadow-2xl">
          <h2
            id="shower-feel-title"
            className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl"
          >
            How do you feel?
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEELINGS.map((f) => (
              <button
                key={f}
                type="button"
                disabled={saveFeeling.isPending}
                className="min-h-[60px] rounded-2xl border-4 border-black bg-white px-4 text-xl font-black text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => saveFeeling.mutate(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-6 min-h-[52px] w-full rounded-2xl border-4 border-slate-400 bg-white text-lg font-bold text-slate-800"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
          {saveFeeling.isError && saveFeeling.error instanceof Error && (
            <p className="mt-4 text-lg font-bold text-red-700" role="alert">
              {saveFeeling.error.message}
            </p>
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <section aria-labelledby="shower-tracker-heading" className="space-y-3">
      <h2
        id="shower-tracker-heading"
        className="text-xs font-bold uppercase tracking-[0.25em] text-slate-900"
      >
        Shower
      </h2>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[60px] w-full items-center justify-center gap-3 rounded-2xl border-4 border-black bg-white px-4 py-4 text-xl font-black uppercase tracking-wide text-slate-900 shadow-md transition hover:bg-slate-50 active:scale-[0.99]"
      >
        <ShowerHead className="h-9 w-9 shrink-0 text-sky-700" aria-hidden />
        Shower tracker
      </button>
      {modal}
      {afterToast && (
        <p
          className="rounded-2xl border-4 border-sky-700 bg-sky-50 px-4 py-4 text-center text-[18px] font-semibold leading-snug text-sky-950"
          role="status"
        >
          {afterToast}
        </p>
      )}
    </section>
  );
}
