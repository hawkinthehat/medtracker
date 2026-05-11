import type { DailyLogEntry, OrthostaticSession } from "@/lib/types";
import type { MedicationLogRow } from "@/lib/supabase/medication-logs";
import type { WeatherLogRow } from "@/lib/supabase/weather-logs";
import { isWithinLastDays } from "@/lib/clinical-summary-stats";
import { standing3mReading } from "@/lib/orthostatic-utils";
import { quickReliefDisplayNameForLoggedMedication } from "@/lib/quick-relief";
import { ADVISORY_PRESSURE_DROP_HPA } from "@/lib/weather";

function parsePressureFromNotes(notes: string | undefined): number | null {
  if (!notes) return null;
  const m = /Atmospheric Pressure:\s*(\d+)\s*hPa/i.exec(notes);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function episodeLogsLast7d(logs: DailyLogEntry[]): DailyLogEntry[] {
  return logs.filter(
    (d) =>
      d.label === "Episode log" &&
      d.category === "other" &&
      isWithinLastDays(d.recordedAt, 7),
  );
}

function weatherIn24hBefore(
  samples: WeatherLogRow[],
  episodeAt: string,
): WeatherLogRow[] {
  const tEnd = new Date(episodeAt).getTime();
  if (Number.isNaN(tEnd)) return [];
  const tStart = tEnd - 24 * 60 * 60 * 1000;
  return samples.filter((w) => {
    const t = new Date(w.recordedAt).getTime();
    return !Number.isNaN(t) && t >= tStart && t <= tEnd;
  });
}

function maxPressureSwingHpa(rows: WeatherLogRow[]): number {
  if (rows.length < 2) return 0;
  let min = Infinity;
  let max = -Infinity;
  for (const r of rows) {
    if (!Number.isFinite(r.pressureHpa)) continue;
    min = Math.min(min, r.pressureHpa);
    max = Math.max(max, r.pressureHpa);
  }
  if (min === Infinity || max === -Infinity) return 0;
  return max - min;
}

function countQuickReliefUses7d(logs: MedicationLogRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of logs) {
    if (!isWithinLastDays(row.recordedAt, 7)) continue;
    const label = quickReliefDisplayNameForLoggedMedication(
      row.medicationName,
    );
    if (!label) continue;
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return map;
}

export async function generateDoctorsSpecialistVaultPdf(params: {
  orthostatic: OrthostaticSession[];
  medicationLogs: MedicationLogRow[];
  dailyLogs: DailyLogEntry[];
  weatherLogs: WeatherLogRow[];
}): Promise<void> {
  const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);

  const orthoRecent = params.orthostatic
    .filter((s) => isWithinLastDays(s.recordedAt, 7))
    .filter((s) => standing3mReading(s))
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );

  const episodes = episodeLogsLast7d(params.dailyLogs).sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  const weatherRecent = params.weatherLogs.filter((w) =>
    isWithinLastDays(w.recordedAt, 7),
  );

  const quickCounts = countQuickReliefUses7d(params.medicationLogs);

  let flareWithSwing = 0;
  for (const ep of episodes) {
    const prior = weatherIn24hBefore(weatherRecent, ep.recordedAt);
    if (maxPressureSwingHpa(prior) >= ADVISORY_PRESSURE_DROP_HPA) {
      flareWithSwing += 1;
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "letter" });
  let y = 16;

  const title = "Tiaki — Specialist visit summary (rolling 7 days)";
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, y, { maxWidth: 182 });
  y += 10;

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated (local device time): ${new Date().toLocaleString()}`, 14, y);
  y += 6;
  doc.text(
    "Patient-generated summary for clinical discussion. Not a medical record or diagnosis.",
    14,
    y,
    { maxWidth: 182 },
  );
  y += 12;

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("1. Orthostatic blood pressure (lying vs standing)", 14, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  if (orthoRecent.length === 0) {
    doc.text(
      "No orthostatic sessions with a standing (3m / 10m) reading in the last 7 days.",
      14,
      y,
      { maxWidth: 182 },
    );
    y += 8;
  } else {
    doc.text(
      "Date/time (local) · Lying S/D mmHg · Standing S/D mmHg · ΔS / ΔD (lying − standing)",
      14,
      y,
      { maxWidth: 182 },
    );
    y += 5;
    for (const s of orthoRecent.slice(0, 20)) {
      const st = standing3mReading(s)!;
      const line = `${new Date(s.recordedAt).toLocaleString()} · ${s.lying.systolic}/${s.lying.diastolic} · ${st.systolic}/${st.diastolic} · ${s.deltaSystolic}/${s.deltaDiastolic}`;
      doc.text(line, 14, y, { maxWidth: 182 });
      y += 4;
      if (y > 268) {
        doc.addPage();
        y = 16;
      }
    }
    if (orthoRecent.length > 20) {
      doc.text(`… plus ${orthoRecent.length - 20} older sessions in window (truncated).`, 14, y);
      y += 5;
    }
    y += 4;
  }

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("2. Quick-relief (PRN) medication logs", 14, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  if (quickCounts.size === 0) {
    doc.text(
      "No quick-relief template matches in medication_logs for this week (Excedrin, ondansetron, etc.).",
      14,
      y,
      { maxWidth: 182 },
    );
    y += 8;
  } else {
    const rows = Array.from(quickCounts.entries()).sort((a, b) => b[1] - a[1]);
    for (const [name, n] of rows) {
      doc.text(`${name}: ${n} dose log${n === 1 ? "" : "s"} this week`, 14, y);
      y += 4;
      if (y > 272) {
        doc.addPage();
        y = 16;
      }
    }
    y += 4;
  }

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("3. Logged flares (Episode log) and barometric context", 14, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  if (episodes.length === 0) {
    doc.text("No Episode log entries in daily_logs for the last 7 days.", 14, y, {
      maxWidth: 182,
    });
    y += 8;
  } else {
    for (const ep of episodes.slice(0, 15)) {
      const pNote = parsePressureFromNotes(ep.notes);
      const prior = weatherIn24hBefore(weatherRecent, ep.recordedAt);
      const swing = maxPressureSwingHpa(prior);
      const swingNote =
        prior.length >= 2 && swing >= ADVISORY_PRESSURE_DROP_HPA
          ? ` ≥${ADVISORY_PRESSURE_DROP_HPA} hPa swing in logged samples in prior 24h`
          : prior.length < 2
            ? " insufficient weather samples in prior 24h"
            : " no large logged swing in prior 24h";
      const head = ep.notes?.split("\n")[0] ?? ep.label;
      const line1 = `${new Date(ep.recordedAt).toLocaleString()} — ${head.slice(0, 90)}${head.length > 90 ? "…" : ""}`;
      doc.text(line1, 14, y, { maxWidth: 182 });
      y += 4;
      const line2 = `Pressure at log (if captured): ${pNote != null ? `${pNote} hPa` : "—"} · prior-24h logged swing ≈ ${Math.round(swing)} hPa${swingNote}`;
      doc.text(line2, 14, y, { maxWidth: 182 });
      y += 6;
      if (y > 260) {
        doc.addPage();
        y = 16;
      }
    }
    if (episodes.length > 15) {
      doc.text(`… ${episodes.length - 15} additional episode(s) omitted for length.`, 14, y);
      y += 5;
    }
  }

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("4. Correlation summary (logged data only)", 14, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Weather samples in window: ${weatherRecent.length}. Episode logs in window: ${episodes.length}. ` +
      `Episodes where logged barometric samples in the prior 24 hours showed a swing ≥ ${ADVISORY_PRESSURE_DROP_HPA} hPa: ${flareWithSwing}.`,
    14,
    y,
    { maxWidth: 182 },
  );

  doc.save(`tiaki-specialist-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
}
