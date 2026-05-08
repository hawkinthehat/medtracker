"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { persistDailyLogToSupabase } from "@/lib/supabase/daily-logs";
import { qk } from "@/lib/query-keys";
import type { DailyLogEntry } from "@/lib/types";

export type SymptomSketchBrushPreset = "burning" | "aching" | "rash";

const VIEWBOX = { w: 120, h: 280 };

const HEAD_PATH =
  "M60 20c-8 0-15 5.5-16.5 13-.9 4-.3 8 1.6 11 1.4 2.3 3.8 4 6.4 4.4v4.6c0 2.2-1.8 4-4 4h-1.5c-1.1 0-2 .9-2 2v2.5c0 1.1.9 2 2 2h29c1.1 0 2-.9 2-2V57c0-1.1-.9-2-2-2h-1.5c-2.2 0-4-1.8-4-4v-4.6c2.6-.4 5-2.1 6.4-4.4 1.9-3 2.5-7 1.6-11C75 25.5 68 20 60 20z";

const TORSO_PATH = "M40 62 L80 62 L84 182 L36 182 Z";

const BRUSH_OPTIONS: {
  preset: SymptomSketchBrushPreset;
  label: string;
  hint: string;
  color: string;
}[] = [
  {
    preset: "burning",
    label: "RED · SFN / burning",
    hint: "Small fiber / burning pain",
    color: "#dc2626",
  },
  {
    preset: "aching",
    label: "PURPLE · Aching / fibro",
    hint: "Diffuse ache",
    color: "#9333ea",
  },
  {
    preset: "rash",
    label: "PINK · MCAS / rash",
    hint: "Flushing or spread",
    color: "#db2777",
  },
];

type SymptomCanvasProps = {
  side: "front" | "back";
  className?: string;
};

export default function SymptomCanvas({ side, className }: SymptomCanvasProps) {
  const qc = useQueryClient();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  const [brush, setBrush] = useState<SymptomSketchBrushPreset>("burning");
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const color = BRUSH_OPTIONS.find((b) => b.preset === brush)?.color ?? "#dc2626";

  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

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
      ctx.lineWidth = Math.max(3, canvas.width * 0.012);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.92;
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

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = pointerPos(e);
    lastRef.current = p;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastRef.current) return;
    const p = pointerPos(e);
    drawSegment(lastRef.current, p);
    lastRef.current = p;
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    drawingRef.current = false;
    lastRef.current = null;
  };

  const saveMutation = useMutation({
    mutationFn: async (): Promise<DailyLogEntry> => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not ready");
      const dataUrl = canvas.toDataURL("image/png");
      const stripped = dataUrl.replace(/^data:image\/png;base64,/, "");
      if (stripped.length < 120) {
        throw new Error("Draw something first, then save.");
      }
      const row: DailyLogEntry = {
        id: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        category: "other",
        label: `Body sketch (${side})`,
        notes: `Symptom map · brush: ${brush}`,
        sketchPngBase64: stripped,
        sketchSide: side,
        sketchBrushPreset: brush,
      };
      if (supabaseConfigured) {
        const ok = await persistDailyLogToSupabase(row);
        if (!ok) throw new Error("Could not save sketch. Check Supabase setup.");
      }
      return row;
    },
    onSuccess: (row) => {
      qc.setQueryData<DailyLogEntry[]>(qk.dailyLogs, (prev = []) => [
        row,
        ...prev,
      ]);
      void qc.invalidateQueries({ queryKey: qk.dailyLogs });
      setSavedHint("Sketch saved to daily log.");
      window.setTimeout(() => setSavedHint(null), 2800);
    },
  });

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSavedHint(null);
    saveMutation.reset();
  };

  const flip = side === "back";

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-300 bg-white p-4 shadow-sm ring-1 ring-slate-200/90",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {BRUSH_OPTIONS.map((b) => (
          <button
            key={b.preset}
            type="button"
            onClick={() => setBrush(b.preset)}
            className={cn(
              "flex min-h-[44px] flex-1 flex-col items-start rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors sm:min-w-[140px] sm:flex-none",
              brush === b.preset
                ? "border-slate-900 bg-slate-100 text-slate-900"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white ring-offset-1 ring-offset-slate-200"
                style={{ backgroundColor: b.color }}
              />
              {b.label}
            </span>
            <span className="mt-0.5 font-normal text-slate-500">{b.hint}</span>
          </button>
        ))}
      </div>

      <div
        ref={wrapRef}
        className="relative mx-auto aspect-[120/280] w-full max-w-[260px] touch-none select-none"
      >
        <svg
          viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
          className="pointer-events-none absolute inset-0 h-full w-full text-slate-700"
          aria-hidden
        >
          <defs>
            <linearGradient id={`sil-bg-${side}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(209 213 219)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="rgb(229 231 235)" stopOpacity="0.75" />
            </linearGradient>
          </defs>
          <g
            transform={
              flip ? `translate(${VIEWBOX.w} 0) scale(-1 1)` : undefined
            }
          >
            <path
              d={`${HEAD_PATH} ${TORSO_PATH}`}
              fill={`url(#sil-bg-${side})`}
              stroke="currentColor"
              strokeWidth={1.25}
            />
          </g>
        </svg>

        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={(e) => {
            if (drawingRef.current) endStroke(e);
          }}
        />
      </div>

      <p className="mt-3 text-center text-xs text-slate-600">
        Draw with a finger or stylus on the silhouette (
        {side === "front" ? "front" : "back"} view).
      </p>

      {!supabaseConfigured && (
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Sketches save on this device; add Supabase to sync{" "}
          <code className="rounded bg-white px-1">daily_logs</code>.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clear}
          className="min-h-[48px] flex-1 rounded-xl border-2 border-slate-400 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
        >
          Clear
        </button>
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="min-h-[48px] flex-1 rounded-xl border-2 border-sky-700 bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-40"
        >
          {saveMutation.isPending ? "Saving…" : "Save sketch"}
        </button>
      </div>

      {saveMutation.isError && saveMutation.error instanceof Error && (
        <p className="mt-2 text-sm font-medium text-red-700" role="alert">
          {saveMutation.error.message}
        </p>
      )}
      {savedHint && (
        <p className="mt-2 text-sm font-medium text-emerald-800" role="status">
          {savedHint}
        </p>
      )}
    </div>
  );
}
