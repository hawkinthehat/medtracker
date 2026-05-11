"use client";

import type { EpisodeEntry, PainRegionId } from "@/lib/types";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  painRegions: Partial<Record<PainRegionId, number>>;
  onSubmit: (entry: Omit<EpisodeEntry, "id" | "recordedAt">) => void;
};

export default function LogEpisodeFab({
  open,
  onClose,
  painRegions,
  onSubmit,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [compressionYes, setCompressionYes] = useState(false);
  const [binderYes, setBinderYes] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => panelRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const description = String(fd.get("episode-desc") ?? "").trim();
    if (!description) return;
    const attachPain =
      fd.get("attach-pain") === "on" &&
      Object.keys(painRegions).some((k) => (painRegions[k as PainRegionId] ?? 0) > 0);
    onSubmit({
      description,
      painRegions: attachPain ? { ...painRegions } : undefined,
      compressionGarment: compressionYes,
      abdominalBinder: binderYes,
    });
    onClose();
  }

  const hasPain = Object.entries(painRegions).some(
    ([, v]) => (v ?? 0) > 0
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="episode-title"
        className="relative z-[61] m-4 w-full max-w-md rounded-2xl border border-slate-300 bg-white p-5 shadow-2xl ring-1 ring-white/10 outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="episode-title"
            className="text-lg font-semibold text-red-100"
          >
            Log episode
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Flares, reactions, syncope, or anything you want your team to know
          about later.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-800">
              What happened?
            </span>
            <textarea
              name="episode-desc"
              rows={4}
              required
              className="mt-2 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-sm text-slate-900 placeholder:text-slate-600 focus:border-red-500/60 focus:outline-none focus:ring-1 focus:ring-red-500/50"
              placeholder="Onset, duration, triggers, associated symptoms…"
            />
          </label>

          <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">
              Compression & binder (for your specialist)
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Wearing compression?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCompressionYes(true)}
                    className={`min-h-[52px] flex-1 rounded-xl border-2 border-slate-900 text-sm font-black ${
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
                    className={`min-h-[52px] flex-1 rounded-xl border-2 border-slate-900 text-sm font-black ${
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
                <p className="text-xs font-semibold text-slate-700">
                  Abdominal binder?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBinderYes(true)}
                    className={`min-h-[52px] flex-1 rounded-xl border-2 border-slate-900 text-sm font-black ${
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
                    className={`min-h-[52px] flex-1 rounded-xl border-2 border-slate-900 text-sm font-black ${
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

          {hasPain && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-slate-100/70 px-3 py-3">
              <input
                type="checkbox"
                name="attach-pain"
                defaultChecked
                className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-slate-700">
                Attach current pain map (regions with intensity &gt; 0)
              </span>
            </label>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-red-900/40 hover:bg-red-500"
            >
              Save episode
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LogEpisodeFloatingButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 z-[55] min-w-[200px] -translate-x-1/2 rounded-full bg-red-600 px-8 py-4 text-center text-base font-bold uppercase tracking-widest text-white shadow-[0_8px_30px_rgba(220,38,38,0.55)] ring-4 ring-red-950/40 hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-300 active:scale-[0.98] motion-safe:transition-transform sm:bottom-[calc(5rem+env(safe-area-inset-bottom))]"
    >
      Log episode
    </button>
  );
}
