import type {
  ClinicalCorrelationSnapshot,
  DailyLogEntry,
  JournalEntry,
  OrthostaticSession,
  VitalRow,
} from "@/lib/types";
import { labelJournalSetting } from "@/lib/journal-setting";
import { standing3mReading } from "@/lib/orthostatic-utils";
import { localDateKeyFromIso } from "@/lib/clinical-correlation";
import type { jsPDF } from "jspdf";

type PdfWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

const MS_DAY = 24 * 60 * 60 * 1000;

function withinLastDays(iso: string, days: number) {
  const t = new Date(iso).getTime();
  return t >= Date.now() - days * MS_DAY;
}

export async function generateThirtyDayMedicalPdf(params: {
  vitals: VitalRow[];
  orthostatic: OrthostaticSession[];
  journal: JournalEntry[];
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const vitals = params.vitals.filter((v) => withinLastDays(v.recordedAt, 30));
  const ortho = params.orthostatic.filter((o) =>
    withinLastDays(o.recordedAt, 30)
  );
  const journal = params.journal.filter((j) =>
    withinLastDays(j.recordedAt, 30)
  );

  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const title = "MedTracker — 30-day clinical summary";
  let y = 16;

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
  y += 6;
  doc.text(
    "Local export for care coordination (KU Medical Center / WashU). Not a substitute for medical records.",
    14,
    y,
    { maxWidth: 180 }
  );
  y += 12;

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Home blood pressure log", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Date / time", "Systolic", "Diastolic", "HR", "Notes"]],
    body: vitals.map((v) => [
      new Date(v.recordedAt).toLocaleString(),
      String(v.systolic),
      String(v.diastolic),
      v.heartRate != null ? String(v.heartRate) : "—",
      v.notes ?? "",
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [248, 250, 252],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  let nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.setTextColor(185, 28, 28);
  doc.text("Orthostatic blood pressure (Δ lying → standing)", 14, nextY + 12);
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.text(
    "Highlighted values meet common orthostatic hypotension criteria: ΔSBP ≥ 20 mmHg and/or ΔDBP ≥ 10 mmHg.",
    14,
    nextY + 17,
    { maxWidth: 180 }
  );

  autoTable(doc, {
    startY: nextY + 22,
    head: [
      [
        "Date",
        "Lying",
        "Sitting",
        "Standing",
        "Δ Sys",
        "Δ Dia",
        "Orthostatic warning",
      ],
    ],
    body: ortho.map((o) => [
      new Date(o.recordedAt).toLocaleString(),
      `${o.lying.systolic}/${o.lying.diastolic}`,
      `${o.sitting.systolic}/${o.sitting.diastolic}`,
      `${standing3mReading(o)?.systolic ?? "—"}/${standing3mReading(o)?.diastolic ?? "—"}`,
      `${o.deltaSystolic}`,
      `${o.deltaDiastolic}`,
      o.positiveOrthostatic ? "YES — positive screen" : "No",
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: {
      fillColor: [127, 29, 29],
      textColor: [254, 226, 226],
      fontStyle: "bold",
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const session = ortho[data.row.index];
      if (!session?.positiveOrthostatic) return;
      const col = data.column.index;
      if (col >= 4) {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [254, 226, 226];
      }
    },
  });

  nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Symptom journal", 14, nextY + 12);

  autoTable(doc, {
    startY: nextY + 16,
    head: [["Date / time", "Indoor / outdoor", "Entry"]],
    body: journal.map((j) => [
      new Date(j.recordedAt).toLocaleString(),
      labelJournalSetting(j.setting),
      j.text,
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [248, 250, 252],
      fontStyle: "bold",
    },
    columnStyles: {
      2: { cellWidth: 110 },
    },
  });

  doc.save(`medtracker-export-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function rowsForLocalDate<T extends { recordedAt: string }>(
  rows: T[],
  dateKey: string
): T[] {
  return rows.filter((r) => localDateKeyFromIso(r.recordedAt) === dateKey);
}

/**
 * HIPAA-styled local PDF for St. Louis transition handoff: locked narratives plus
 * same-calendar-day source rows (PHI layout — organizational compliance is separate).
 */
export async function generateClinicalCorrelationLockedPdf(params: {
  dateKey: string;
  snapshot: ClinicalCorrelationSnapshot;
  vitals: VitalRow[];
  orthostatic: OrthostaticSession[];
  dailyLogs: DailyLogEntry[];
  journal: JournalEntry[];
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const vitals = rowsForLocalDate(params.vitals, params.dateKey);
  const ortho = rowsForLocalDate(params.orthostatic, params.dateKey);
  const logs = rowsForLocalDate(params.dailyLogs, params.dateKey);
  const journal = rowsForLocalDate(params.journal, params.dateKey);

  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 12;

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 26, "F");
  doc.setTextColor(248, 250, 252);
  doc.setFontSize(11);
  doc.text("CONFIDENTIAL — PROTECTED HEALTH INFORMATION (PHI)", 14, 10);
  doc.setFontSize(8);
  doc.text(
    "Minimum necessary · St. Louis care transition team · No redisclosure without valid authorization",
    14,
    17,
    { maxWidth: pageW - 28 }
  );
  y = 32;

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.text("Clinical correlation & same-day source record", 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Local calendar date: ${params.dateKey}`, 14, y);
  y += 5;
  doc.text(`Generated (device): ${new Date().toLocaleString()}`, 14, y);
  y += 6;
  doc.setFontSize(8.5);
  doc.text(
    "Created locally by MedTracker for continuity of care. Not a substitute for a formal medical records request or HIPAA-covered entity release.",
    14,
    y,
    { maxWidth: pageW - 28 }
  );
  y += 14;

  doc.setDrawColor(148, 163, 184);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, pageW - 28, 28, "FD");
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  const notice = doc.splitTextToSize(
    "Recipient responsibilities: limit access to transition staff, store encrypted where possible, transmit only through approved channels, and retain per policy. " +
      "Patient / device user: by exporting you confirm you may share this PHI with the St. Louis transition team.",
    pageW - 32
  );
  doc.text(notice, 16, y + 5);
  y += 34;

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Locked correlation narratives", 14, y);
  y += 6;
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  for (const line of params.snapshot.narratives) {
    const wrapped = doc.splitTextToSize(`• ${line}`, pageW - 28);
    doc.text(wrapped, 16, y);
    y += wrapped.length * 4.8 + 2;
  }

  y += 4;
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Snapshot computed: ${new Date(params.snapshot.computedAt).toLocaleString()} · ` +
      `Engine: ${params.snapshot.trigger === "scheduled_21_00" ? "Nightly (9 PM)" : "Preview"} · ` +
      `Locked: ${params.snapshot.locked ? "Yes" : "No"}` +
      (params.snapshot.lockedAt
        ? ` · Lock time: ${new Date(params.snapshot.lockedAt).toLocaleString()}`
        : ""),
    14,
    y,
    { maxWidth: pageW - 28 }
  );
  y += 12;

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Same-day vitals (spot checks)", 14, y);

  autoTable(doc, {
    startY: y + 4,
    head: [["Date / time", "Systolic", "Diastolic", "HR", "Notes"]],
    body: vitals.map((v) => [
      new Date(v.recordedAt).toLocaleString(),
      String(v.systolic),
      String(v.diastolic),
      v.heartRate != null ? String(v.heartRate) : "—",
      v.notes ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [248, 250, 252],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  let nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.setTextColor(127, 29, 29);
  doc.text("Same-day orthostatic sessions", 14, nextY + 10);
  autoTable(doc, {
    startY: nextY + 14,
    head: [
      [
        "Date",
        "Lying",
        "Standing",
        "Δ Sys",
        "Δ Dia",
        "Positive screen",
      ],
    ],
    body: ortho.map((o) => [
      new Date(o.recordedAt).toLocaleString(),
      `${o.lying.systolic}/${o.lying.diastolic}`,
      `${standing3mReading(o)?.systolic ?? "—"}/${standing3mReading(o)?.diastolic ?? "—"}`,
      `${o.deltaSystolic}`,
      `${o.deltaDiastolic}`,
      o.positiveOrthostatic ? "Yes" : "No",
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: [127, 29, 29],
      textColor: [254, 226, 226],
      fontStyle: "bold",
    },
  });

  nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Same-day daily logs", 14, nextY + 10);
  autoTable(doc, {
    startY: nextY + 14,
    head: [["Date / time", "Category", "Label", "Notes"]],
    body: logs.map((d) => [
      new Date(d.recordedAt).toLocaleString(),
      d.category,
      d.label,
      d.notes ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [248, 250, 252],
      fontStyle: "bold",
    },
    columnStyles: { 3: { cellWidth: 65 } },
  });

  nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.text("Same-day symptom journal", 14, nextY + 10);
  autoTable(doc, {
    startY: nextY + 14,
    head: [["Date / time", "Indoor / outdoor", "Entry"]],
    body: journal.map((j) => [
      new Date(j.recordedAt).toLocaleString(),
      labelJournalSetting(j.setting),
      j.text,
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [248, 250, 252],
      fontStyle: "bold",
    },
    columnStyles: { 2: { cellWidth: 110 } },
  });

  nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Footer: MedTracker does not transmit this file. Secure the copy you save or send.",
    14,
    Math.min(nextY + 14, doc.internal.pageSize.getHeight() - 10)
  );

  doc.save(
    `medtracker-st-louis-clinical-correlation-${params.dateKey}.pdf`
  );
}
