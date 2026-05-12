import type {
  ClinicalCorrelationSnapshot,
  ClinicalCorrelationTrigger,
  DailyLogEntry,
  JournalEntry,
  OrthostaticSession,
  VitalRow,
} from "@/lib/types";
import {
  DOG_WALK_MARKER,
  PT_MARKER_PREFIX,
  extractAmbientFromMovementNotes,
} from "@/lib/movement-tracking";

const ACTIVITY_LOOKBACK_MS = 6 * 60 * 60 * 1000;
const MEAL_SYMPTOM_WINDOW_MS = 4 * 60 * 60 * 1000;

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function localDateKeyFromIso(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLocalDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function filterByLocalDate<T extends { recordedAt: string }>(
  rows: T[],
  dateKey: string
): T[] {
  return rows.filter((r) => localDateKeyFromIso(r.recordedAt) === dateKey);
}

/** Latest activity log strictly before `beforeMs`, within lookback. */
function latestActivityBefore(
  activities: DailyLogEntry[],
  beforeMs: number,
  lookbackMs: number
): DailyLogEntry | null {
  const windowStart = beforeMs - lookbackMs;
  let best: DailyLogEntry | null = null;
  let bestT = -1;
  for (const a of activities) {
    const t = new Date(a.recordedAt).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= beforeMs || t < windowStart) continue;
    if (t > bestT) {
      bestT = t;
      best = a;
    }
  }
  return best;
}

function orthostaticDropScore(o: OrthostaticSession): number {
  return o.deltaSystolic + 0.5 * o.deltaDiastolic;
}

export function computeBpDropAfterActivityNarrative(
  orthostatic: OrthostaticSession[],
  dailyLogs: DailyLogEntry[],
  dateKey: string
): string | null {
  const dayOrtho = filterByLocalDate(orthostatic, dateKey);
  const dayActs = dailyLogs.filter(
    (a) =>
      localDateKeyFromIso(a.recordedAt) === dateKey &&
      (a.category === "activity" || a.category === "movement"),
  );
  if (dayOrtho.length === 0) return null;

  let bestSession: OrthostaticSession | null = null;
  let bestScore = -Infinity;
  for (const o of dayOrtho) {
    const s = orthostaticDropScore(o);
    if (s > bestScore) {
      bestScore = s;
      bestSession = o;
    }
  }
  if (!bestSession) return null;

  const sessionMs = new Date(bestSession.recordedAt).getTime();
  const act = latestActivityBefore(dayActs, sessionMs, ACTIVITY_LOOKBACK_MS);
  if (act) {
    return `Today, your BP drops (lying → standing) were largest after ${act.label}.`;
  }
  return `Today, your largest orthostatic BP change (lying → standing) was Δ ${bestSession.deltaSystolic}/${bestSession.deltaDiastolic} mmHg; no activity was logged in the six hours before that session to name a trigger.`;
}

export function computeSpotBpDropAfterActivityNarrative(
  vitals: VitalRow[],
  dailyLogs: DailyLogEntry[],
  dateKey: string
): string | null {
  const v = filterByLocalDate(vitals, dateKey).filter(
    (x) => !Number.isNaN(new Date(x.recordedAt).getTime())
  );
  const dayActs = dailyLogs.filter(
    (a) =>
      localDateKeyFromIso(a.recordedAt) === dateKey &&
      (a.category === "activity" || a.category === "movement"),
  );
  if (v.length < 2) return null;
  v.sort(
    (a, b) =>
      new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  let maxDrop = 0;
  let dropAtIndex = -1;
  for (let i = 1; i < v.length; i++) {
    const drop = v[i - 1].systolic - v[i].systolic;
    if (drop > maxDrop) {
      maxDrop = drop;
      dropAtIndex = i;
    }
  }
  if (maxDrop < 8 || dropAtIndex < 0) return null;

  const lowerReading = v[dropAtIndex];
  const lowerMs = new Date(lowerReading.recordedAt).getTime();
  const act = latestActivityBefore(dayActs, lowerMs, ACTIVITY_LOOKBACK_MS);
  if (act) {
    return `Among spot BP checks today, systolic fell by ${maxDrop} mmHg with the next reading after ${act.label}.`;
  }
  return `Among spot BP checks today, systolic fell by ${maxDrop} mmHg between consecutive readings; log activities before readings to sharpen “after [X]” wording.`;
}

/** Summarize movement logs that carry ambient temperature / pressure for clinical correlation. */
export function computeMovementWeatherNarrative(
  dailyLogs: DailyLogEntry[],
  dateKey: string,
): string | null {
  const day = dailyLogs.filter(
    (e) =>
      localDateKeyFromIso(e.recordedAt) === dateKey &&
      (e.category === "activity" || e.category === "movement") &&
      Boolean(
        e.notes?.includes(DOG_WALK_MARKER) ||
          e.notes?.includes(PT_MARKER_PREFIX),
      ),
  );
  if (day.length === 0) return null;

  const temps: number[] = [];
  const pressures: number[] = [];
  for (const e of day) {
    const a = extractAmbientFromMovementNotes(e.notes);
    if (a.tempC != null) temps.push(a.tempC);
    if (a.pressureHpa != null) pressures.push(a.pressureHpa);
  }

  if (temps.length === 0 && pressures.length === 0) {
    return `${day.length} movement session(s) logged today — ambient lines will appear after weather is fetched when logging walks or PT.`;
  }

  const bits: string[] = [];
  if (temps.length === 1) bits.push(`ambient ${temps[0].toFixed(1)}°C`);
  else if (temps.length > 1) {
    bits.push(
      `ambient temp ${Math.min(...temps).toFixed(1)}–${Math.max(...temps).toFixed(1)}°C`,
    );
  }
  if (pressures.length === 1) {
    bits.push(`pressure ~${Math.round(pressures[0])} hPa`);
  } else if (pressures.length > 1) {
    bits.push(
      `pressure ${Math.round(Math.min(...pressures))}–${Math.round(Math.max(...pressures))} hPa`,
    );
  }

  let line = `Movement / PT today (${day.length} session(s)): ${bits.join("; ")}`;
  line +=
    " — compare walk counts vs sticky humid days as summer progresses.";
  return line;
}

const SYMPTOM_SPIKE =
  /\b(worse|flare|spike|mast|reaction|dizzy|dizziness|nausea|tachy|tachycardia|pain|headache|presyncope|syncope|hr\b|heart rate)\b/i;

export function computeSymptomAfterMealNarrative(
  dailyLogs: DailyLogEntry[],
  journal: JournalEntry[],
  dateKey: string
): string | null {
  const foods = dailyLogs.filter(
    (d) =>
      localDateKeyFromIso(d.recordedAt) === dateKey && d.category === "food"
  );
  const journals = journal.filter(
    (j) => localDateKeyFromIso(j.recordedAt) === dateKey
  );
  if (foods.length === 0 || journals.length === 0) return null;

  type Pair = {
    food: DailyLogEntry;
    j: JournalEntry;
    minutes: number;
    spike: boolean;
  };
  const pairs: Pair[] = [];

  for (const f of foods) {
    const ft = new Date(f.recordedAt).getTime();
    if (Number.isNaN(ft)) continue;
    for (const j of journals) {
      const jt = new Date(j.recordedAt).getTime();
      if (Number.isNaN(jt)) continue;
      if (jt <= ft) continue;
      if (jt - ft > MEAL_SYMPTOM_WINDOW_MS) continue;
      const minutes = Math.round((jt - ft) / (60 * 1000));
      pairs.push({ food: f, j, minutes, spike: SYMPTOM_SPIKE.test(j.text) });
    }
  }
  if (pairs.length === 0) return null;

  const spikePairs = pairs.filter((p) => p.spike);
  const pool = spikePairs.length > 0 ? spikePairs : pairs;
  pool.sort((a, b) => a.minutes - b.minutes);
  const best = pool[0];
  const verb = spikePairs.length > 0 ? "spiked" : "were logged";
  return `Symptoms ${verb} ${best.minutes} minutes after ${best.food.label}.`;
}

export function buildClinicalCorrelationSnapshot(input: {
  dateKey: string;
  vitals: VitalRow[];
  orthostatic: OrthostaticSession[];
  dailyLogs: DailyLogEntry[];
  journal: JournalEntry[];
  trigger: ClinicalCorrelationTrigger;
  previous?: ClinicalCorrelationSnapshot | null;
}): ClinicalCorrelationSnapshot {
  const {
    dateKey,
    vitals,
    orthostatic,
    dailyLogs,
    journal,
    trigger,
    previous,
  } = input;

  if (previous?.locked) {
    return previous;
  }

  const narratives: string[] = [];
  const dayOrtho = filterByLocalDate(orthostatic, dateKey);

  if (dayOrtho.length > 0) {
    const n = computeBpDropAfterActivityNarrative(
      orthostatic,
      dailyLogs,
      dateKey
    );
    if (n) narratives.push(n);
  } else {
    const spot = computeSpotBpDropAfterActivityNarrative(
      vitals,
      dailyLogs,
      dateKey
    );
    if (spot) narratives.push(spot);
    else {
      narratives.push(
        "No orthostatic session or clear spot-to-spot systolic fall was logged today to correlate with activities."
      );
    }
  }

  const mealSym = computeSymptomAfterMealNarrative(dailyLogs, journal, dateKey);
  if (mealSym) narratives.push(mealSym);
  else {
    narratives.push(
      "No same-day meal and symptom journal pair was found within four hours for a timed correlation.",
    );
  }

  const moveWx = computeMovementWeatherNarrative(dailyLogs, dateKey);
  if (moveWx) narratives.push(moveWx);

  return {
    dateKey,
    computedAt: new Date().toISOString(),
    trigger,
    narratives,
    locked: false,
  };
}
