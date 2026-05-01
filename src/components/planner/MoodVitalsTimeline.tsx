"use client";

import { useMemo } from "react";
import type {
  EpisodeEntry,
  MoodEntry,
  PainMapSnapshot,
  PainRegionId,
  VitalRow,
} from "@/lib/types";
import { PAIN_LABELS } from "./PainMapBody";

type Row =
  | { kind: "vital"; at: string; id: string; vital: VitalRow }
  | { kind: "mood"; at: string; id: string; mood: MoodEntry }
  | { kind: "episode"; at: string; id: string; episode: EpisodeEntry }
  | { kind: "pain"; at: string; id: string; pain: PainMapSnapshot };

const MOOD_EMOJI: Record<MoodEntry["mood"], string> = {
  1: "😔",
  2: "😐",
  3: "😕",
  4: "🙂",
  5: "😊",
};

type Props = {
  vitals: VitalRow[];
  moods: MoodEntry[];
  episodes: EpisodeEntry[];
  painSnapshots: PainMapSnapshot[];
  onLogMood: (mood: MoodEntry["mood"]) => void;
  /** When false, mood emoji buttons are hidden (e.g. mood is logged from MoodTracker above). */
  showMoodButtons?: boolean;
};

export default function MoodVitalsTimeline({
  vitals,
  moods,
  episodes,
  painSnapshots,
  onLogMood,
  showMoodButtons = true,
}: Props) {
  const rows = useMemo(() => {
    const list: Row[] = [
      ...vitals.map((v) => ({
        kind: "vital" as const,
        at: v.recordedAt,
        id: v.id,
        vital: v,
      })),
      ...moods.map((m) => ({
        kind: "mood" as const,
        at: m.recordedAt,
        id: m.id,
        mood: m,
      })),
      ...episodes.map((e) => ({
        kind: "episode" as const,
        at: e.recordedAt,
        id: e.id,
        episode: e,
      })),
      ...painSnapshots.map((p) => ({
        kind: "pain" as const,
        at: p.recordedAt,
        id: p.id,
        pain: p,
      })),
    ];
    list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return list.slice(0, 28);
  }, [vitals, moods, episodes, painSnapshots]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Mood & vitals timeline
        </h2>
        {showMoodButtons && (
          <div className="flex flex-wrap gap-1.5">
            {([1, 2, 3, 4, 5] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onLogMood(m)}
                className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-lg leading-none hover:border-sky-500/50 hover:bg-slate-900"
                title={`Log mood ${m}/5`}
                aria-label={`Log mood ${m} of 5`}
              >
                {MOOD_EMOJI[m]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative max-h-[320px] overflow-y-auto rounded-xl border border-slate-700/80 bg-slate-950/40 pr-1">
        <ul className="divide-y divide-slate-800/90">
          {rows.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              No mood, vitals, or episodes yet. Log BP from Vitals or tap a mood
              above.
            </li>
          )}
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <time
                  className="font-mono text-[11px] text-slate-500"
                  dateTime={row.at}
                >
                  {new Date(row.at).toLocaleString()}
                </time>
                {row.kind === "vital" && (
                  <span className="rounded bg-emerald-950/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-800/50">
                    Vitals
                  </span>
                )}
                {row.kind === "mood" && (
                  <span className="rounded bg-indigo-950/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200 ring-1 ring-indigo-800/50">
                    Mood
                  </span>
                )}
                {row.kind === "episode" && (
                  <span className="rounded bg-red-950/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200 ring-1 ring-red-800/50">
                    Episode
                  </span>
                )}
                {row.kind === "pain" && (
                  <span className="rounded bg-rose-950/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200 ring-1 ring-rose-800/50">
                    Pain map
                  </span>
                )}
              </div>
              {row.kind === "vital" && (
                <p className="mt-1 font-mono text-sm text-slate-100">
                  {row.vital.systolic}/{row.vital.diastolic}
                  {row.vital.heartRate != null
                    ? ` · HR ${row.vital.heartRate}`
                    : ""}
                </p>
              )}
              {row.kind === "mood" && (
                <p className="mt-1 text-sm text-slate-200">
                  <span className="mr-2 text-lg">
                    {MOOD_EMOJI[row.mood.mood]}
                  </span>
                  Mood {row.mood.mood}/5
                  {row.mood.note ? ` · ${row.mood.note}` : ""}
                </p>
              )}
              {row.kind === "episode" && (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-slate-200">
                  {row.episode.description}
                </p>
              )}
              {row.kind === "pain" && (
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {(Object.entries(row.pain.regions) as [PainRegionId, number][])
                    .filter(([, lvl]) => (lvl ?? 0) > 0)
                    .map(([reg, lvl]) => `${PAIN_LABELS[reg]} (${lvl})`)
                    .join(" · ") || "Snapshot (no regions marked)"}
                </p>
              )}
              {row.kind === "vital" && row.vital.notes && (
                <p className="mt-1 text-xs text-slate-500">{row.vital.notes}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
