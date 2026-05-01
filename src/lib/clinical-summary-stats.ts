import { standing3mReading } from "@/lib/orthostatic-utils";
import type {
  BrainFogEntry,
  EpisodeEntry,
  MoodEntry,
  OrthostaticSession,
  PainMapSnapshot,
  PainRegionId,
  SafetyGateBlockEvent,
} from "@/lib/types";

/** Same order as PainMapBody — used for stable sort / totals. */
const PAIN_REGION_ORDER: PainRegionId[] = [
  "head",
  "neck",
  "chest",
  "abdomen",
  "pelvis",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg",
];

export function isWithinLastDays(recordedAt: string, days: number): boolean {
  const t = new Date(recordedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * 24 * 60 * 60 * 1000;
}

export function isWithinLast30Days(recordedAt: string): boolean {
  return isWithinLastDays(recordedAt, 30);
}

export type OrthostaticSystolicSummary = {
  sessionCount: number;
  meanLyingSystolic: number | null;
  meanStandingSystolic: number | null;
  /** Mean (lying − standing 3m) systolic; positive = drop on standing. */
  meanSystolicDrop: number | null;
};

export function summarizeOrthostaticSystolic30d(
  sessions: OrthostaticSession[]
): OrthostaticSystolicSummary {
  const recent = sessions.filter((s) => isWithinLast30Days(s.recordedAt));
  const withStanding = recent.filter((s) => standing3mReading(s));

  if (withStanding.length === 0) {
    return {
      sessionCount: 0,
      meanLyingSystolic: null,
      meanStandingSystolic: null,
      meanSystolicDrop: null,
    };
  }

  let sumLie = 0;
  let sumStand = 0;
  let sumDrop = 0;

  for (const s of withStanding) {
    const st = standing3mReading(s)!;
    const lie = s.lying.systolic;
    sumLie += lie;
    sumStand += st.systolic;
    sumDrop += lie - st.systolic;
  }

  const n = withStanding.length;
  return {
    sessionCount: n,
    meanLyingSystolic: sumLie / n,
    meanStandingSystolic: sumStand / n,
    meanSystolicDrop: sumDrop / n,
  };
}

function regionsWithActivity(
  map: Partial<Record<PainRegionId, number>> | undefined
): PainRegionId[] {
  if (!map) return [];
  const out: PainRegionId[] = [];
  for (const id of PAIN_REGION_ORDER) {
    const v = map[id];
    if ((v ?? 0) > 0) out.push(id);
  }
  return out;
}

export type RegionDensityRow = {
  region: PainRegionId;
  flareEvents: number;
};

export function symptomDensityByRegion30d(
  episodes: EpisodeEntry[],
  painSnapshots: PainMapSnapshot[]
): RegionDensityRow[] {
  const counts: Record<PainRegionId, number> = {
    head: 0,
    neck: 0,
    chest: 0,
    abdomen: 0,
    pelvis: 0,
    leftArm: 0,
    rightArm: 0,
    leftLeg: 0,
    rightLeg: 0,
  };

  for (const e of episodes) {
    if (!isWithinLast30Days(e.recordedAt)) continue;
    for (const id of regionsWithActivity(e.painRegions)) {
      counts[id] += 1;
    }
  }

  for (const p of painSnapshots) {
    if (!isWithinLast30Days(p.recordedAt)) continue;
    for (const id of regionsWithActivity(p.regions)) {
      counts[id] += 1;
    }
  }

  return PAIN_REGION_ORDER.map((region) => ({
    region,
    flareEvents: counts[region],
  })).sort((a, b) => b.flareEvents - a.flareEvents);
}

export function countSafetyGateBlocks30d(
  events: SafetyGateBlockEvent[]
): number {
  return events.filter((e) => isWithinLast30Days(e.recordedAt)).length;
}

export function rollingAverageMood7d(moods: MoodEntry[]): number | null {
  const recent = moods.filter((m) => isWithinLastDays(m.recordedAt, 7));
  if (recent.length === 0) return null;
  return recent.reduce((acc, m) => acc + m.mood, 0) / recent.length;
}

export function rollingAverageBrainFog7d(
  entries: BrainFogEntry[]
): number | null {
  const recent = entries.filter((e) => isWithinLastDays(e.recordedAt, 7));
  if (recent.length === 0) return null;
  return recent.reduce((acc, e) => acc + e.score, 0) / recent.length;
}

export type OrthostaticDeltaAverage = {
  count: number;
  meanDeltaSystolic: number | null;
  meanDeltaDiastolic: number | null;
};

/** Mean lying→standing Δ using sessions with a standing (3m or legacy) reading. */
export function averageOrthostaticDeltaLastDays(
  sessions: OrthostaticSession[],
  days: number
): OrthostaticDeltaAverage {
  const recent = sessions.filter((s) => isWithinLastDays(s.recordedAt, days));
  const withStand = recent.filter((s) => standing3mReading(s));
  if (withStand.length === 0) {
    return {
      count: 0,
      meanDeltaSystolic: null,
      meanDeltaDiastolic: null,
    };
  }
  let sumS = 0;
  let sumD = 0;
  for (const s of withStand) {
    sumS += s.deltaSystolic;
    sumD += s.deltaDiastolic;
  }
  const n = withStand.length;
  return {
    count: n,
    meanDeltaSystolic: sumS / n,
    meanDeltaDiastolic: sumD / n,
  };
}
