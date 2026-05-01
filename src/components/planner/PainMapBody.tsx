"use client";

import type { PainRegionId } from "@/lib/types";

export const PAIN_REGION_ORDER: PainRegionId[] = [
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

export const PAIN_LABELS: Record<PainRegionId, string> = {
  head: "Head",
  neck: "Neck",
  chest: "Chest",
  abdomen: "Abdomen",
  pelvis: "Pelvis",
  leftArm: "L arm",
  rightArm: "R arm",
  leftLeg: "L leg",
  rightLeg: "R leg",
};

const STEPS = [0, 3, 5, 8, 10] as const;

type RegionPath = { id: PainRegionId; d: string };

const REGIONS: RegionPath[] = [
  {
    id: "head",
    d: "M60 18c-7.5 0-14 5-15.5 12.5-.8 3.5-.3 7 1.2 9.5 1.2 2 3.2 3.4 5.5 3.8v4.2c0 2.2-1.8 4-4 4h-1c-1.1 0-2 .9-2 2v2.5c0 1.1.9 2 2 2h28.5c1.1 0 2-.9 2-2V56c0-1.1-.9-2-2-2h-1c-2.2 0-4-1.8-4-4v-4.2c2.3-.4 4.3-1.8 5.5-3.8 1.5-2.5 2-6 1.2-9.5C74 23 67.5 18 60 18z",
  },
  {
    id: "neck",
    d: "M52 68h16v14H52V68z",
  },
  {
    id: "chest",
    d: "M38 82h44l4 52H34l4-52z",
  },
  {
    id: "abdomen",
    d: "M34 134h52l-3 46H37l-3-46z",
  },
  {
    id: "pelvis",
    d: "M37 178h46l-5 36H42l-5-36z",
  },
  {
    id: "leftArm",
    d: "M34 86 L22 92 L14 148 L22 152 L30 100 L38 94 Z",
  },
  {
    id: "rightArm",
    d: "M86 86 L98 92 L106 148 L98 152 L90 100 L82 94 Z",
  },
  {
    id: "leftLeg",
    d: "M42 212 H54 L52 252 H44 Z",
  },
  {
    id: "rightLeg",
    d: "M66 212 H78 L76 252 H68 Z",
  },
];

function intensityFill(level: number | undefined): string {
  if (!level || level <= 0) return "rgba(148, 163, 184, 0.12)";
  const a = 0.12 + (level / 10) * 0.55;
  return `rgba(239, 68, 68, ${a})`;
}

function intensityStroke(level: number | undefined): string {
  if (!level || level <= 0) return "rgba(100, 116, 139, 0.65)";
  return "rgba(248, 113, 113, 0.95)";
}

type Props = {
  regions: Partial<Record<PainRegionId, number>>;
  onRegionPress: (id: PainRegionId) => void;
};

export default function PainMapBody({ regions, onRegionPress }: Props) {
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 120 260"
        className="h-auto w-full max-w-[220px] touch-manipulation"
        role="img"
        aria-label="Front body pain map — tap a region to set intensity"
      >
        <title>Pain map</title>
        {REGIONS.map(({ id, d }) => {
          const level = regions[id];
          return (
            <path
              key={id}
              d={d}
              fill={intensityFill(level)}
              stroke={intensityStroke(level)}
              strokeWidth={1.2}
              strokeLinejoin="round"
              className="cursor-pointer transition-[fill,stroke] duration-150"
              onClick={() => onRegionPress(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRegionPress(id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${PAIN_LABELS[id]}, intensity ${level ?? 0} of 10`}
            />
          );
        })}
      </svg>
      <p className="mt-3 max-w-[240px] text-center text-xs leading-snug text-slate-500">
        Tap a region to cycle intensity (0 → 3 → 5 → 8 → 10). Save snapshot
        to record on your timeline.
      </p>
    </div>
  );
}

export function cyclePainLevel(current: number | undefined): number {
  const c = current ?? 0;
  const idx = STEPS.findIndex((s) => s === c);
  if (idx >= 0) return STEPS[(idx + 1) % STEPS.length];
  return STEPS[1];
}
