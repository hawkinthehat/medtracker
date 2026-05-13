/**
 * Offline “best guess” kcal from a free-text meal description (not medical advice).
 * Uses simple keyword totals and quantity heuristics, then a bounded fallback.
 */

const EGG_KCAL = 70;
const BREAD_SLICE_KCAL = 80;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Returns a rounded best-guess calorie total for a meal description.
 */
export function estimateCaloriesFromDescription(raw: string): number {
  const s = raw.trim().toLowerCase();
  if (!s) return 0;

  const normalized = s.replace(/\s+/g, " ");

  // Explicit “X kcal” / “X calories”
  const explicit =
    normalized.match(/(\d+)\s*(?:kcal|cal(?:ories)?)\b/i) ??
    normalized.match(/(?:~|about|approx\.?)\s*(\d+)\b/);
  if (explicit) {
    const v = Number(explicit[1]);
    if (Number.isFinite(v) && v >= 50 && v <= 5000) return Math.round(v);
  }

  // Phrase-level anchors (common meals)
  const anchors: [RegExp, number][] = [
    [/2\s*eggs?\s+and\s+toast/i, 350],
    [/eggs?\s+and\s+toast/i, 320],
    [/scrambled\s+eggs?/i, 200],
    [/oatmeal|porridge/i, 220],
    [/cereal\s+with\s+milk/i, 280],
    [/yogurt|yoghurt/i, 180],
    [/salad(\s|$)/i, 220],
    [/burger/i, 650],
    [/pizza(\s|$|,)/i, 700],
    [/sandwich/i, 450],
    [/ramen|noodles?/i, 400],
    [/rice\s+and\s+beans/i, 480],
    [/chicken\s+breast/i, 280],
    [/grilled\s+chicken/i, 350],
    [/soup/i, 200],
    [/smoothie/i, 320],
    [/apple/i, 95],
    [/banana/i, 105],
  ];
  for (const [re, kcal] of anchors) {
    if (re.test(normalized)) return kcal;
  }

  // Counted eggs + toast (after phrase anchors so “2 eggs and toast” wins above)
  const eggMatch = normalized.match(/(\d+(?:\.\d+)?)\s+eggs?\b/i);
  let eggN: number | null = eggMatch ? Number(eggMatch[1]) : null;
  if (eggN == null && /\beggs?\b/.test(normalized)) eggN = 2;
  const toastSlice =
    normalized.match(
      /(\d+(?:\.\d+)?)\s*(?:pieces?|slices?)\s+of\s+toast\b/i,
    )?.[1] ?? normalized.match(/(\d+(?:\.\d+)?)\s+toast\s+slices?\b/i)?.[1];
  const toastN = toastSlice != null
    ? Number(toastSlice)
    : /\btoast\b/.test(normalized)
      ? 1
      : null;
  if (eggN != null || toastN != null) {
    const e = eggN != null && Number.isFinite(eggN) ? eggN : 0;
    const t = toastN != null && Number.isFinite(toastN) ? toastN : 0;
    if (e > 0 || t > 0) {
      const total = Math.round(e * EGG_KCAL + t * BREAD_SLICE_KCAL);
      if (total >= 120) return clamp(total, 150, 900);
    }
  }

  // Very short snack vs meal-ish words
  const words = normalized.split(/\s+/).filter(Boolean);
  const w = words.length;
  let base = 40 * w + 120;
  if (/\b(snack|bar|handful)\b/i.test(normalized)) base = Math.min(base, 280);
  if (/\b(breakfast|lunch|dinner|feast|plate)\b/i.test(normalized))
    base = Math.max(base, 420);
  if (/\b(large|big|extra)\b/i.test(normalized)) base += 180;
  if (/\b(small|light|half)\b/i.test(normalized)) base -= 100;

  return clamp(Math.round(base), 180, 950);
}
