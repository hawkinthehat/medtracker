"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { persistDailyLogToSupabase } from "@/lib/supabase/daily-logs";
import { qk } from "@/lib/query-keys";
import type { DailyLogEntry } from "@/lib/types";
import { TOAST_SYMPTOM_MAP } from "@/lib/educational-toasts";
import ClinicalBodySilhouette, {
  CLINICAL_VIEWBOX,
} from "@/components/journal/ClinicalBodySilhouette";

export type SymptomSketchBrushPreset = "burning" | "aching" | "rash";

const BRUSH_OPTIONS: {
  preset: SymptomSketchBrushPreset;
  label: string;
  short: string;
  color: string;
}[] = [
  {
    preset: "burning",
    label: "RED · SFN / burning",
    short: "Burning",
    color: "#dc2626",
  },
  {
    preset: "aching",
    label: "PURPLE · Aching",
    short: "Aching",
    color: "#9333ea",
  },
  {
    preset: "rash",
    label: "PINK · MCAS / rash",
    short: "Rash",
    color: "#db2777",
  },
];

const QUICK_NOTE_LABELS = ["Burning", "Aching", "Rash"] as const;

/** Large tap targets for common dysautonomia sensations (append to spot note). */
const DYSAUT_QUICK_TAGS = [
  "Coat hanger pain",
  "Presyncope",
  "Blood pooling",
  "Air hunger",
] as const;

const INK_THRESHOLD_PX = 8;

type SymptomCanvasProps = {
  side: "front" | "back";
  className?: string;
};

function buildSketchRow(
  side: "front" | "back",
  brush: SymptomSketchBrushPreset,
  pngBase64: string,
  spotNote: string,
  labelSuffix: "spot" | "daily",
): DailyLogEntry {
  const baseNote =
    labelSuffix === "spot"
      ? spotNote.trim() || "—"
      : spotNote.trim() || "Daily symptom map snapshot";
  return {
    id: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
    category: "other",
    label:
      labelSuffix === "spot"
        ? `Symptom mark · ${side}`
        : `Daily symptom map · ${side}`,
    notes: [
      baseNote,
      `Brush: ${brush}`,
      `View: ${side === "front" ? "Front" : "Back"}`,
    ].join("\n"),
    sketchPngBase64: pngBase64,
    sketchSide: side,
  };
}

export default function SymptomCanvas({ side, className }: SymptomCanvasProps) {
  const qc = useQueryClient();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const inkAccumRef = useRef(0);
  /** Brush active when the stroke ended — used when saving so modal quick-picks don’t change ink color. */
  const brushAtStrokeEndRef = useRef<SymptomSketchBrushPreset>("burning");

  const [brush, setBrush] = useState<SymptomSketchBrushPreset>("burning");
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [mounted, setMounted] = useState(false);

  const color = BRUSH_OPTIONS.find((b) => b.preset === brush)?.color ?? "#dc2626";
  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

  useEffect(() => setMounted(true), []);

  const resizeCanvas = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2.5);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(() => resizeCanvas());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  const drawSegment = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(10, canvas.width * 0.028);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    },
    [color],
  );

  const pointerPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  }, []);

  const persistRow = useCallback(
    async (row: DailyLogEntry) => {
      if (supabaseConfigured) {
        const result = await persistDailyLogToSupabase(row);
        if (!result.ok)
          throw new Error(result.error ?? "Could not save. Check Supabase setup.");
      }
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [row, ...prev]);
      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
    },
    [qc, supabaseConfigured],
  );

  const capturePng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL("image/png");
    const stripped = dataUrl.replace(/^data:image\/png;base64,/, "");
    if (stripped.length < 120) return null;
    return stripped;
  }, []);

  const saveSpotMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const png = capturePng();
      if (!png) throw new Error("Draw on the figure first.");
      const preset = brushAtStrokeEndRef.current;
      const row = buildSketchRow(side, preset, png, noteText, "spot");
      await persistRow(row);
      return row;
    },
    onSuccess: () => {
      setNoteModalOpen(false);
      setDraftNote("");
      setSavedHint(TOAST_SYMPTOM_MAP);
      window.setTimeout(() => setSavedHint(null), 2800);
    },
  });

  const saveDailyMutation = useMutation({
    mutationFn: async () => {
      const png = capturePng();
      if (!png) throw new Error("Draw something on the map first.");
      const row = buildSketchRow(
        side,
        brush,
        png,
        `Saved ${new Date().toLocaleString()}`,
        "daily",
      );
      await persistRow(row);
      return row;
    },
    onSuccess: () => {
      setSavedHint(TOAST_SYMPTOM_MAP);
      window.setTimeout(() => setSavedHint(null), 2800);
    },
  });

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (noteModalOpen) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    inkAccumRef.current = 0;
    const p = pointerPos(e);
    lastRef.current = p;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastRef.current || noteModalOpen) return;
    const p = pointerPos(e);
    const dx = p.x - lastRef.current.x;
    const dy = p.y - lastRef.current.y;
    inkAccumRef.current += Math.hypot(dx, dy);
    drawSegment(lastRef.current, p);
    lastRef.current = p;
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const hadInk = inkAccumRef.current >= INK_THRESHOLD_PX;
    if (drawingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    drawingRef.current = false;
    lastRef.current = null;
    if (hadInk && !noteModalOpen) {
      brushAtStrokeEndRef.current = brush;
      setDraftNote("");
      setNoteModalOpen(true);
    }
    inkAccumRef.current = 0;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSavedHint(null);
    saveSpotMutation.reset();
    saveDailyMutation.reset();
  };

  const noteModal =
    mounted &&
    noteModalOpen &&
    createPortal(
      <div
        className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`spot-note-title-${side}`}
      >
        <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl border-4 border-black bg-white p-6 shadow-2xl">
          <h3
            id={`spot-note-title-${side}`}
            className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl"
          >
            What are you feeling here?
          </h3>
          <p className="mt-4 text-xl font-bold text-slate-900">
            Tap a quick note or write your own below.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {QUICK_NOTE_LABELS.map((label) => (
              <button
                key={label}
                type="button"
                className="min-h-[60px] rounded-2xl border-4 border-black bg-white px-3 text-xl font-black text-slate-900 hover:bg-slate-50"
                onClick={() => {
                  setDraftNote(label);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-6 text-xl font-black text-slate-900">
            Dysautonomia quick tags
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DYSAUT_QUICK_TAGS.map((label) => (
              <button
                key={label}
                type="button"
                className="min-h-[72px] rounded-2xl border-4 border-indigo-900 bg-indigo-50 px-3 text-lg font-black leading-snug text-indigo-950 hover:bg-indigo-100"
                onClick={() => {
                  setDraftNote(label);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label
            htmlFor={`spot-note-${side}`}
            className="mt-6 block text-2xl font-black text-slate-900"
          >
            Add detail (optional)
          </label>
          <textarea
            id={`spot-note-${side}`}
            rows={5}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="Type here…"
            className="mt-3 min-h-[160px] w-full rounded-2xl border-4 border-black bg-white px-4 py-4 text-2xl font-bold leading-snug text-slate-900 placeholder:text-slate-600 placeholder:font-semibold focus:outline-none focus:ring-4 focus:ring-slate-400"
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="min-h-[60px] flex-1 rounded-2xl border-4 border-black bg-white text-xl font-bold text-slate-900 hover:bg-slate-50"
              onClick={() => {
                setNoteModalOpen(false);
                setDraftNote("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveSpotMutation.isPending}
              className="min-h-[60px] flex-[2] rounded-2xl border-4 border-black bg-white text-2xl font-black uppercase tracking-wide text-slate-900 hover:bg-slate-100 disabled:opacity-50"
              onClick={() => saveSpotMutation.mutate(draftNote)}
            >
              {saveSpotMutation.isPending ? "Saving…" : "SAVE NOTE"}
            </button>
          </div>
          {saveSpotMutation.isError && saveSpotMutation.error instanceof Error && (
            <p className="mt-4 text-xl font-bold text-red-700" role="alert">
              {saveSpotMutation.error.message}
            </p>
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <div
      className={cn(
        "relative rounded-2xl border-4 border-black bg-white p-3 shadow-sm sm:p-4",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap gap-3">
        {BRUSH_OPTIONS.map((b) => (
          <button
            key={b.preset}
            type="button"
            disabled={noteModalOpen}
            onClick={() => setBrush(b.preset)}
            className={cn(
              "flex min-h-[60px] flex-1 flex-col items-center justify-center rounded-2xl border-4 px-3 py-2 text-center transition sm:min-w-[10rem] sm:flex-none",
              brush === b.preset
                ? "border-black bg-slate-900 text-white"
                : "border-slate-900 bg-white text-slate-900 hover:bg-slate-50",
            )}
          >
            <span
              className="mb-1 h-4 w-4 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-white"
              style={{ backgroundColor: b.color }}
            />
            <span className="text-lg font-black leading-tight">{b.short}</span>
            <span className="text-xs font-bold uppercase tracking-wide opacity-90">
              {b.preset === "burning"
                ? "SFN"
                : b.preset === "aching"
                  ? "Fibro"
                  : "MCAS"}
            </span>
          </button>
        ))}
      </div>

      <div
        ref={wrapRef}
        style={{
          aspectRatio: `${CLINICAL_VIEWBOX.w} / ${CLINICAL_VIEWBOX.h}`,
        }}
        className={cn(
          "relative mx-auto w-[min(100%,80vw)] max-w-full touch-none select-none",
        )}
      >
        <ClinicalBodySilhouette
          side={side}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 h-full w-full cursor-crosshair",
            noteModalOpen && "pointer-events-none",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={(e) => {
            if (drawingRef.current) endStroke(e);
          }}
        />
      </div>

      <p className="mt-4 text-center text-base font-semibold text-slate-900">
        Freely circle an area on the figure ({side === "front" ? "front" : "back"}
        ). When you lift your finger, describe what you feel — or save the full
        map with the button below.
      </p>

      {!supabaseConfigured && (
        <p className="mt-3 rounded-xl border-2 border-amber-500 bg-amber-50 px-3 py-2 text-base font-semibold text-amber-950">
          Sketches save on this device; connect Supabase to sync{" "}
          <code className="rounded bg-white px-1 font-mono text-sm">daily_logs</code>
          .
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={noteModalOpen}
          className="min-h-[60px] flex-1 rounded-2xl border-4 border-slate-700 bg-white px-4 text-xl font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      {saveDailyMutation.isError && saveDailyMutation.error instanceof Error && (
        <p className="mt-3 text-lg font-bold text-red-700" role="alert">
          {saveDailyMutation.error.message}
        </p>
      )}
      {savedHint && (
        <p className="mt-3 text-[18px] font-semibold leading-snug text-emerald-900" role="status">
          {savedHint}
        </p>
      )}

      <div
        className={cn(
          "sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] mt-6",
          noteModalOpen && "pointer-events-none opacity-40",
        )}
      >
        <button
          type="button"
          disabled={saveDailyMutation.isPending || noteModalOpen}
          onClick={() => saveDailyMutation.mutate()}
          className="w-full min-h-[64px] rounded-2xl border-4 border-black bg-white px-4 py-3 text-xl font-black uppercase tracking-wide text-slate-900 shadow-lg hover:bg-slate-50 disabled:opacity-40"
        >
          {saveDailyMutation.isPending ? "Saving…" : "SAVE DAILY SYMPTOM MAP"}
        </button>
      </div>

      {noteModal}
    </div>
  );
}
