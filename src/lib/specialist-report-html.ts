import type { DailyLogEntry, OrthostaticSession } from "@/lib/types";
import type { MedicationLogRow } from "@/lib/supabase/medication-logs";
import type { WeatherLogRow } from "@/lib/supabase/weather-logs";
import { isWithinLastDays } from "@/lib/clinical-summary-stats";
import { standing3mReading, standingPhaseReading } from "@/lib/orthostatic-utils";
import {
  sumThermotabsSodiumMgLastDays,
  sumWaterOzLastDays,
} from "@/lib/hydration-summary";
import { ADVISORY_PRESSURE_DROP_HPA } from "@/lib/weather";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

export type SpecialistReportHtmlInput = {
  orthostatic: OrthostaticSession[];
  dailyLogs: DailyLogEntry[];
  medicationLogs: MedicationLogRow[];
  weatherLogs: WeatherLogRow[];
};

export function buildSpecialistReportHtmlDocument(
  input: SpecialistReportHtmlInput,
): string {
  const orthoRecent = input.orthostatic
    .filter((s) => isWithinLastDays(s.recordedAt, 7))
    .filter((s) => standing3mReading(s))
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );

  const waterOz7 = sumWaterOzLastDays(input.dailyLogs, 7);
  const sodiumMg7 = sumThermotabsSodiumMgLastDays(input.medicationLogs, 7);

  const episodes = episodeLogsLast7d(input.dailyLogs).sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  const weatherRecent = input.weatherLogs.filter((w) =>
    isWithinLastDays(w.recordedAt, 7),
  );

  let flareWithSwing = 0;
  const flareNotes: string[] = [];
  for (const ep of episodes.slice(0, 20)) {
    const prior = weatherIn24hBefore(weatherRecent, ep.recordedAt);
    const swing = maxPressureSwingHpa(prior);
    if (prior.length >= 2 && swing >= ADVISORY_PRESSURE_DROP_HPA) {
      flareWithSwing += 1;
    }
    const pNote = parsePressureFromNotes(ep.notes);
    const head = (ep.notes?.split("\n")[0] ?? ep.label).slice(0, 120);
    flareNotes.push(
      `${new Date(ep.recordedAt).toLocaleString()}: ${esc(head)} — logged pressure at event: ${
        pNote != null ? `${pNote} hPa` : "—"
      }; prior-24h logged swing ≈ ${Math.round(swing)} hPa${
        prior.length < 2 ? " (few samples)" : ""
      }.`,
    );
  }

  const orthoRows = orthoRecent
    .slice(0, 24)
    .map((s) => {
      const st = standingPhaseReading(s);
      const sbp = standing3mReading(s);
      const lieHr =
        s.lying.heartRate != null ? String(s.lying.heartRate) : "—";
      const stHr = st?.heartRate != null ? String(st.heartRate) : "—";
      let dHr = "—";
      if (s.lying.heartRate != null && st?.heartRate != null) {
        dHr = String(st.heartRate - s.lying.heartRate);
      }
      return `<tr><td>${esc(new Date(s.recordedAt).toLocaleString())}</td><td>${s.lying.systolic}/${s.lying.diastolic}</td><td>${lieHr}</td><td>${sbp?.systolic ?? "—"}/${sbp?.diastolic ?? "—"}</td><td>${stHr}</td><td>${s.deltaSystolic}/${s.deltaDiastolic}</td><td>${dHr}</td></tr>`;
    })
    .join("");

  const narrative = `Episodes logged this week with usable prior-24h barometric samples showing a swing ≥ ${ADVISORY_PRESSURE_DROP_HPA} hPa: ${flareWithSwing} of ${episodes.length}. Total weather samples in window: ${weatherRecent.length}.`;

  const bodyInner = `
    <header>
      <h1>Tiaki — Specialist report (7 days)</h1>
      <p class="muted">Patient-generated summary. Not a medical record.</p>
      <p class="muted">Generated ${esc(new Date().toLocaleString())}</p>
    </header>

    <section>
      <h2>1. Volumes (rolling 7 days)</h2>
      <table>
        <tbody>
          <tr><th scope="row">Water logged</th><td>${waterOz7} fl oz</td></tr>
          <tr><th scope="row">Sodium (Thermotabs taps)</th><td>${sodiumMg7} mg</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>2. Orthostatic BP / HR (lying vs standing)</h2>
      <p class="muted">Standing column uses 10m / 3m / legacy standing reading when present. Δ BP = lying − standing (mmHg). Δ HR = standing − lying.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Lying S/D</th>
              <th>Lying HR</th>
              <th>Standing S/D</th>
              <th>Standing HR</th>
              <th>Δ S/D</th>
              <th>Δ HR</th>
            </tr>
          </thead>
          <tbody>
            ${
              orthoRows ||
              '<tr><td colspan="7">No orthostatic sessions with a standing reading in the last 7 days.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>3. Pressure vs flare notes</h2>
      <p class="muted">${esc(narrative)}</p>
      <ul class="flare-list">
        ${
          flareNotes.length
            ? flareNotes.map((n) => `<li>${n}</li>`).join("")
            : "<li>No episode logs in the last 7 days.</li>"
        }
      </ul>
    </section>

    <footer>
      <p>Use your browser print dialog (Ctrl/Cmd+P) for a clean handout.</p>
    </footer>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tiaki Specialist Report</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      font-family: system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: #0b1220;
      color: #f8fafc;
      line-height: 1.45;
    }
    main { max-width: 920px; margin: 0 auto; padding: 28px 22px 48px; }
    header { border-bottom: 2px solid #38bdf8; padding-bottom: 18px; margin-bottom: 24px; }
    h1 { font-size: 1.55rem; letter-spacing: -0.02em; margin: 0 0 8px; }
    h2 { font-size: 1.1rem; margin: 28px 0 12px; color: #bae6fd; }
    .muted { color: #94a3b8; font-size: 0.9rem; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { border: 1px solid #334155; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #0f172a; color: #e2e8f0; }
    tr:nth-child(even) td { background: #111827; }
    tr:nth-child(odd) td { background: #0f172a; }
    .table-wrap { overflow-x: auto; border: 1px solid #38bdf8; border-radius: 10px; }
    ul.flare-list { margin: 0; padding-left: 1.15rem; }
    li { margin-bottom: 10px; }
    footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #334155; font-size: 0.85rem; color: #cbd5e1; }
    @media print {
      body { background: #fff; color: #000; }
      main { max-width: none; padding: 12px; }
      th, td { border-color: #000; color: #000; background: #fff !important; }
      h2 { color: #000; }
      .muted { color: #333; }
      footer { color: #000; border-color: #000; }
      .table-wrap { border-color: #000; }
    }
  </style>
</head>
<body>
  <main>${bodyInner}</main>
</body>
</html>`;
}

export function openSpecialistReportHtmlWindow(input: SpecialistReportHtmlInput): boolean {
  const html = buildSpecialistReportHtmlDocument(input);
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
