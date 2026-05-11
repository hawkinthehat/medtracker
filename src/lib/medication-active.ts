import type { SavedMedication } from "@/lib/seed-medications";

/** Local calendar day key `YYYY-MM-DD` (no timezone shift vs Date APIs). */
export function calendarDayKeyLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDayKey(iso: string): Date {
  const [y, mo, day] = iso.split("-").map(Number);
  return new Date(y, mo - 1, day);
}

/** Whole calendar days from `isoFrom` → `isoTo` (non-inclusive end semantics match date subtraction). */
export function calendarDaysBetween(isoFrom: string, isoTo: string): number {
  const a = parseLocalDayKey(isoFrom);
  const b = parseLocalDayKey(isoTo);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function addCalendarDays(isoDay: string, deltaDays: number): string {
  const d = parseLocalDayKey(isoDay);
  d.setDate(d.getDate() + deltaDays);
  return calendarDayKeyLocal(d);
}

/** Temporary course has ended when today's calendar day is strictly after `tempEndDate`. */
export function isExpiredTemporaryMed(
  m: SavedMedication,
  todayKey = calendarDayKeyLocal(),
): boolean {
  return Boolean(
    m.isTemporary && m.tempEndDate && m.tempEndDate.length >= 10 && m.tempEndDate < todayKey,
  );
}

export function getActiveMedications(
  meds: SavedMedication[],
  todayKey = calendarDayKeyLocal(),
): SavedMedication[] {
  return meds.filter((m) => !isExpiredTemporaryMed(m, todayKey));
}

export function getCompletedTemporaryMedications(
  meds: SavedMedication[],
  todayKey = calendarDayKeyLocal(),
): SavedMedication[] {
  return meds.filter((m) => isExpiredTemporaryMed(m, todayKey));
}

/** Temporary meds whose course ended within the last `windowDays` (by end date). */
export function getRecentlyCompletedTemporaryMedications(
  meds: SavedMedication[],
  todayKey = calendarDayKeyLocal(),
  windowDays = 90,
): SavedMedication[] {
  return meds
    .filter((m) => {
      if (!m.isTemporary || !m.tempEndDate) return false;
      if (m.tempEndDate >= todayKey) return false;
      const since = calendarDaysBetween(m.tempEndDate, todayKey);
      return since >= 0 && since <= windowDays;
    })
    .sort((a, b) => (b.tempEndDate ?? "").localeCompare(a.tempEndDate ?? ""));
}
