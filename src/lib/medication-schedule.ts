import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  SEED_SAVED_MEDICATIONS,
  type SavedMedication,
} from "@/lib/seed-medications";

export const DEFAULT_DOSE_DURATION_MIN = 60;
/** Fluconazole modeled as CYP3A4 inhibition lasting this long after a dose for timeline overlap. */
export const INHIBITOR_ACTIVE_MIN = 8 * 60;

const BP_LOWERING_NAMES = new Set(
  ["duloxetine", "trazodone", "lorazepam"].map((s) => s.toLowerCase())
);

export function normalizeMedName(name: string): string {
  return name.trim().toLowerCase();
}

export function isBloodPressureLoweringName(name: string): boolean {
  return BP_LOWERING_NAMES.has(normalizeMedName(name));
}

export function isFluconazoleName(name: string): boolean {
  return normalizeMedName(name) === "fluconazole";
}

export function isGleevecOrLatudaName(name: string): boolean {
  const n = normalizeMedName(name);
  return n === "gleevec" || n === "latuda";
}

export type ScheduledDose = {
  id: string;
  medicationName: string;
  startMinute: number;
  durationMinutes: number;
};

/** Stack overlapping dose bars into lanes for the timeline. */
export function assignDoseLanes(doses: ScheduledDose[]): Map<string, number> {
  const sorted = [...doses].sort((a, b) => a.startMinute - b.startMinute);
  const laneEnds: number[] = [];
  const map = new Map<string, number>();
  for (const d of sorted) {
    const end = d.startMinute + d.durationMinutes;
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] > d.startMinute) {
      lane++;
    }
    if (lane === laneEnds.length) laneEnds.push(end);
    else laneEnds[lane] = end;
    map.set(d.id, lane);
  }
  return map;
}

function parseTimeToMinutes(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (
    Number.isNaN(h) ||
    Number.isNaN(min) ||
    h > 23 ||
    min > 59 ||
    h < 0 ||
    min < 0
  )
    return null;
  return h * 60 + min;
}

function coerceScheduledTimes(row: Record<string, unknown>): string[] {
  const raw =
    row.scheduled_times ?? row.schedule_times ?? row.times ?? row.dose_times;
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      /* ignore */
    }
  }
  const single = row.time_of_day ?? row.scheduled_time;
  if (typeof single === "string" && single.trim()) return [single.trim()];
  return [];
}

/**
 * Reads `medications` (or `medication_schedule`) from Supabase.
 * Expected columns: id, name, optional scheduled_times text/json array of "HH:MM",
 * optional duration_minutes.
 */
export async function fetchScheduledDosesFromSupabase(): Promise<
  ScheduledDose[]
> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const tables = ["medications", "medication_schedule"] as const;
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) continue;
    if (!data?.length) continue;

    const doses: ScheduledDose[] = [];
    for (const row of data as Record<string, unknown>[]) {
      const id =
        typeof row.id === "string"
          ? row.id
          : typeof row.id === "number"
            ? String(row.id)
            : crypto.randomUUID();
      const name =
        typeof row.name === "string"
          ? row.name
          : typeof row.medication_name === "string"
            ? row.medication_name
            : "";
      if (!name.trim()) continue;

      const durationRaw = row.duration_minutes ?? row.duration ?? row.span_minutes;
      const durationMinutes =
        typeof durationRaw === "number" && durationRaw > 0
          ? Math.min(durationRaw, 24 * 60)
          : DEFAULT_DOSE_DURATION_MIN;

      const times = coerceScheduledTimes(row);
      if (times.length === 0) continue;

      for (let i = 0; i < times.length; i++) {
        const mins = parseTimeToMinutes(times[i]);
        if (mins == null) continue;
        doses.push({
          id: `${id}-${i}`,
          medicationName: name.trim(),
          startMinute: mins,
          durationMinutes,
        });
      }
    }
    if (doses.length) return doses;
  }
  return [];
}

/** Demo timeline when Supabase is unset or returns no rows — staggers seed meds across the day. */
export function buildFallbackScheduleFromSeed(
  meds: SavedMedication[] = SEED_SAVED_MEDICATIONS
): ScheduledDose[] {
  const extra: SavedMedication[] = [
    {
      id: "demo-fluconazole",
      name: "Fluconazole",
      pathway: "CYP3A4",
      is_inhibitor: true,
      is_substrate: false,
      pathway_role: "Strong CYP3A4 inhibitor",
    },
    {
      id: "demo-gleevec",
      name: "Gleevec",
      pathway: "CYP3A4",
      is_inhibitor: false,
      is_substrate: true,
      pathway_role: "Substrate (spikes)",
    },
    {
      id: "demo-latuda",
      name: "Latuda",
      pathway: "CYP3A4",
      is_inhibitor: false,
      is_substrate: true,
      pathway_role: "Substrate (spikes)",
    },
  ];
  const all = [...meds, ...extra];
  return all.map((m, i) => ({
    id: `fallback-${m.id}`,
    medicationName: m.name,
    startMinute: (8 * 60 + i * 77 + (m.name.length % 13) * 5) % (14 * 60) + 6 * 60,
    durationMinutes: DEFAULT_DOSE_DURATION_MIN,
  }));
}

export type RedZoneInterval = { start: number; end: number };

/**
 * Yellow "red zones": two distinct BP-lowering meds (Duloxetine, Trazodone, Lorazepam)
 * with dose start times within `windowMin` minutes.
 */
export function computeBloodPressureClusterZones(
  doses: ScheduledDose[],
  windowMin = 120
): RedZoneInterval[] {
  const bpDoses = doses.filter((d) =>
    isBloodPressureLoweringName(d.medicationName)
  );
  const intervals: RedZoneInterval[] = [];

  for (let i = 0; i < bpDoses.length; i++) {
    for (let j = i + 1; j < bpDoses.length; j++) {
      const a = bpDoses[i];
      const b = bpDoses[j];
      if (
        normalizeMedName(a.medicationName) ===
        normalizeMedName(b.medicationName)
      ) {
        continue;
      }
      const gap = Math.abs(a.startMinute - b.startMinute);
      if (gap <= windowMin) {
        const start = Math.min(a.startMinute, b.startMinute);
        const end = Math.max(
          a.startMinute + a.durationMinutes,
          b.startMinute + b.durationMinutes
        );
        intervals.push({ start, end });
      }
    }
  }

  return mergeIntervals(intervals);
}

function mergeIntervals(intervals: RedZoneInterval[]): RedZoneInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: RedZoneInterval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push(cur);
    }
  }
  return out;
}

export type InhibitorActiveWindow = { start: number; end: number };

export function computeFluconazoleWindows(doses: ScheduledDose[]): InhibitorActiveWindow[] {
  const flu = doses.filter((d) => isFluconazoleName(d.medicationName));
  const windows: InhibitorActiveWindow[] = [];
  for (const d of flu) {
    const start = d.startMinute;
    const end = start + INHIBITOR_ACTIVE_MIN;
    if (end <= 1440) {
      windows.push({ start, end });
    } else {
      windows.push({ start, end: 1440 });
      windows.push({ start: 0, end: end - 1440 });
    }
  }
  return mergeInhibitorWindows(windows);
}

function mergeInhibitorWindows(
  w: InhibitorActiveWindow[]
): InhibitorActiveWindow[] {
  if (w.length === 0) return [];
  const sorted = [...w].sort((a, b) => a.start - b.start);
  const out: InhibitorActiveWindow[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push(cur);
    }
  }
  return out;
}

function intervalsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number }
): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Substrate doses that fall under active Fluconazole inhibition windows. */
export function substrateDosesWithInhibitorGlow(
  doses: ScheduledDose[],
  inhibitorWindows: InhibitorActiveWindow[]
): Set<string> {
  const ids = new Set<string>();
  if (inhibitorWindows.length === 0) return ids;

  for (const d of doses) {
    if (!isGleevecOrLatudaName(d.medicationName)) continue;
    const block = {
      start: d.startMinute,
      end: d.startMinute + d.durationMinutes,
    };
    for (const w of inhibitorWindows) {
      if (intervalsOverlap(block, w)) {
        ids.add(d.id);
        break;
      }
    }
  }
  return ids;
}
