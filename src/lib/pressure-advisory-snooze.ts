/** Suppress the home barometric pressure warning after dismiss (local device). */
export const PRESSURE_ADVISORY_SUPPRESS_UNTIL_LS =
  "tiaki-pressure-advisory-suppress-until-ms";

const FOUR_H_MS = 4 * 60 * 60 * 1000;

export function readPressureAdvisorySuppressUntilMs(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(PRESSURE_ADVISORY_SUPPRESS_UNTIL_LS);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Hide the advisory until this timestamp (epoch ms). */
export function suppressPressureAdvisory4h(): void {
  const until = Date.now() + FOUR_H_MS;
  try {
    window.localStorage.setItem(
      PRESSURE_ADVISORY_SUPPRESS_UNTIL_LS,
      String(until),
    );
  } catch {
    /* ignore */
  }
}

export function isPressureAdvisorySuppressed(now = Date.now()): boolean {
  const until = readPressureAdvisorySuppressUntilMs();
  return until > 0 && now < until;
}
