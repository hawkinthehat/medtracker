import {
  BLURRY_VISION_LABEL,
  FIBRO_PAIN_SYMPTOMS,
  FIBRO_RESTLESS_SLEEP,
  FIBRO_STIFFNESS,
  SYMPTOM_MATRIX_CATEGORY_IDS,
  SYMPTOM_MATRIX_CATEGORY_SHORT,
  SYMPTOM_MATRIX_PILLAR_IDS,
  type SymptomMatrixCategoryId,
} from "@/lib/symptom-matrix-data";
import type { SymptomLogRow } from "@/lib/supabase/symptom-logs";

const MS_DAY = 24 * 60 * 60 * 1000;

const WEEKLY_SUMMARY_ORDER: SymptomMatrixCategoryId[] = [
  ...SYMPTOM_MATRIX_PILLAR_IDS,
  "general",
];

function isRollingSevenDays(recordedIso: string, endAt: Date): boolean {
  const t = new Date(recordedIso).getTime();
  const end = endAt.getTime();
  const start = end - 7 * MS_DAY;
  return t >= start && t <= end;
}

function countPhrase(n: number, singular: string, plural: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}

function normSymptom(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * One-line specialist-facing summary of Symptom Matrix taps, grouped by category.
 */
export function buildSymptomMatrixRollingSevenDaySummary(
  logs: SymptomLogRow[],
  endAt: Date = new Date(),
): string {
  const week = logs.filter((l) => isRollingSevenDays(l.recordedAt, endAt));
  if (week.length === 0) {
    return "This week: no Symptom Matrix quick-taps recorded.";
  }

  const parts: string[] = [];

  for (const id of WEEKLY_SUMMARY_ORDER) {
    const catLogs = week.filter((l) => l.category === id);
    if (catLogs.length === 0) continue;

    if (id === "dysautonomia") {
      const blurryLower = BLURRY_VISION_LABEL.toLowerCase();
      const blurryCount = catLogs.filter(
        (l) => l.symptomName.trim().toLowerCase() === blurryLower,
      ).length;
      let segment = countPhrase(
        catLogs.length,
        "Dysautonomia flare",
        "Dysautonomia flares",
      );
      if (blurryCount > 0) {
        segment += ` (${BLURRY_VISION_LABEL} ${blurryCount}×)`;
      }
      parts.push(segment);
    } else if (id === "mcas") {
      parts.push(
        countPhrase(catLogs.length, "MCAS reaction", "MCAS reactions"),
      );
    } else if (id === "autoimmune_sjogrens") {
      parts.push(
        countPhrase(catLogs.length, "Sjögren's flare", "Sjögren's flares"),
      );
    } else if (id === "fibromyalgia") {
      parts.push(countPhrase(catLogs.length, "Fibro flare", "Fibro flares"));
    } else if (id === "general") {
      parts.push(
        countPhrase(catLogs.length, "general quick-tap", "general quick-taps"),
      );
    }
  }

  const unknown = week.filter(
    (l) =>
      !SYMPTOM_MATRIX_CATEGORY_IDS.includes(
        l.category as SymptomMatrixCategoryId,
      ),
  );
  if (unknown.length > 0) {
    parts.push(
      countPhrase(unknown.length, "other-category tap", "other-category taps"),
    );
  }

  if (parts.length === 0) {
    return "This week: no Symptom Matrix quick-taps recorded.";
  }

  return `This week: ${parts.join(", ")}.`;
}

/**
 * Fibromyalgia-only breakdown: pain vs stiffness vs other fibro symptoms for specialists
 * (compare with dysautonomia / orthostatic timing when reviewing barometric triggers).
 */
export function buildFibromyalgiaTrendsSummary(
  logs: SymptomLogRow[],
  endAt: Date = new Date(),
): string {
  const week = logs.filter((l) => isRollingSevenDays(l.recordedAt, endAt));
  const fib = week.filter((l) => l.category === "fibromyalgia");
  if (fib.length === 0) {
    return "No Fibromyalgia-category taps in this window.";
  }

  const painSet = new Set(FIBRO_PAIN_SYMPTOMS.map(normSymptom));
  const stiffnessN = normSymptom(FIBRO_STIFFNESS);

  let painTaps = 0;
  const painByName = new Map<string, number>();
  let stiffnessCount = 0;
  let fogCount = 0;
  let sleepCount = 0;
  let otherFib = 0;

  for (const row of fib) {
    const n = normSymptom(row.symptomName);
    if (painSet.has(n)) {
      painTaps += 1;
      const key = row.symptomName.trim();
      painByName.set(key, (painByName.get(key) ?? 0) + 1);
    } else if (n === stiffnessN) {
      stiffnessCount += 1;
    } else if (n === "fibro fog") {
      fogCount += 1;
    } else if (n === normSymptom(FIBRO_RESTLESS_SLEEP)) {
      sleepCount += 1;
    } else {
      otherFib += 1;
    }
  }

  const painBits: string[] = [];
  for (const label of FIBRO_PAIN_SYMPTOMS) {
    const c = painByName.get(label) ?? 0;
    if (c > 0) painBits.push(`${label} ${c}×`);
  }
  const painDetail =
    painBits.length > 0 ? ` (${painBits.join(", ")})` : "";
  const painSeg =
    painTaps > 0
      ? `Pain-related: ${painTaps}${painDetail}`
      : "Pain-related: 0";

  const stiffSeg = `Stiffness: ${stiffnessCount}×`;
  const extra: string[] = [];
  if (fogCount > 0) extra.push(`Fibro Fog ${fogCount}×`);
  if (sleepCount > 0) extra.push(`Restless sleep ${sleepCount}×`);
  if (otherFib > 0) extra.push(`Other fibro-label taps ${otherFib}×`);

  const tail = extra.length > 0 ? ` · ${extra.join(", ")}` : "";

  return `${painSeg}; ${stiffSeg}${tail}. Total Fibromyalgia-category taps: ${fib.length}. Compare timing with orthostatic/BP rows and weather notes above when assessing barometric overlap with dysautonomia flares.`;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function buildSymptomLogsTodayTotalsLine(
  logs: SymptomLogRow[],
  now: Date = new Date(),
): string {
  const day0 = startOfLocalDay(now).getTime();
  const day1 = endOfLocalDay(now).getTime();
  const today = logs.filter((l) => {
    const t = new Date(l.recordedAt).getTime();
    return t >= day0 && t <= day1;
  });
  if (today.length === 0) {
    return "Today: no quick-taps yet.";
  }

  const counts = new Map<SymptomMatrixCategoryId, number>();
  for (const id of SYMPTOM_MATRIX_CATEGORY_IDS) counts.set(id, 0);
  for (const row of today) {
    const id = row.category as SymptomMatrixCategoryId;
    if (!SYMPTOM_MATRIX_CATEGORY_IDS.includes(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const segments: string[] = [];
  for (const id of WEEKLY_SUMMARY_ORDER) {
    const n = counts.get(id) ?? 0;
    if (n === 0) continue;
    segments.push(`${n} ${SYMPTOM_MATRIX_CATEGORY_SHORT[id]}`);
  }

  const unknownToday = today.filter(
    (l) =>
      !SYMPTOM_MATRIX_CATEGORY_IDS.includes(
        l.category as SymptomMatrixCategoryId,
      ),
  );
  if (unknownToday.length > 0) {
    segments.push(`${unknownToday.length} other`);
  }

  return `Today: ${segments.join(", ")}.`;
}
