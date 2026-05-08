import type { MedicationHistoryEntry } from "@/lib/medication-profile-types";
import type { SavedMedication } from "@/lib/seed-medications";
import type {
  ClinicalCorrelationSnapshot,
  DailyLogEntry,
  JournalEntry,
  OrthostaticSession,
  SafetyGateBlockEvent,
  SideEffectLog,
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

/** Bundles “deep” app data for silent auditing / specialist PDF export. */
export type DoctorReportInput = {
  patientLabel?: string;
  medications: SavedMedication[];
  medicationHistory: MedicationHistoryEntry[];
  orthostatic: OrthostaticSession[];
  vitals: VitalRow[];
  dailyLogs: DailyLogEntry[];
  safetyGateBlocks: SafetyGateBlockEvent[];
  sideEffectLogs: SideEffectLog[];
};

export function compileDoctorReportBundle(
  input: DoctorReportInput
): DoctorReportInput & { compiledAt: string } {
  return {
    ...input,
    compiledAt: new Date().toISOString(),
  };
}

/**
 * Clean white-background PDF for a new specialist: meds, change history,
 * positional BP deltas, gate events, and embedded body sketches from daily_logs.
 */
export async function generateDoctorSpecialistPdf(
  input: DoctorReportInput
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const bundle = compileDoctorReportBundle(input);
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.text("Clinical summary — specialist handoff", 14, y);
  y += 9;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${new Date(bundle.compiledAt).toLocaleString()}`, 14, y);
  y += 5;
  doc.text(
    bundle.patientLabel ?? "Patient: Jade · MedTracker export",
    14,
    y,
    { maxWidth: pageW - 28 }
  );
  y += 10;

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Active medication list", 14, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [["Medication", "Class / notes (seed)"]],
    body: bundle.medications.map((m) => [
      m.name,
      m.pathway_role ?? m.pathway,
    ]),
    styles: { fontSize: 9, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    theme: "plain",
  });

  let nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.text("Medication & schedule change history", 14, nextY + 12);
  autoTable(doc, {
    startY: nextY + 16,
    head: [["Date", "Medication", "Change", "Reason"]],
    body: bundle.medicationHistory.slice(0, 80).map((h) => [
      new Date(h.recordedAt).toLocaleString(),
      h.medicationName,
      `${h.changeKind}: ${h.newDoseLabel ?? ""} ${(h.newScheduledTimes ?? []).join(", ")}`.trim(),
      h.reason,
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    columnStyles: { 3: { cellWidth: 55 } },
    theme: "plain",
  });

  nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.setTextColor(127, 29, 29);
  doc.text("Orthostatic / positional BP (delta lying → standing)", 14, nextY + 12);
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.text(
    "Δ values highlight positional drops relevant to OH screening.",
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
        "Standing",
        "Δ Sys",
        "Δ Dia",
        "Positive screen",
      ],
    ],
    body: bundle.orthostatic.slice(0, 40).map((o) => [
      new Date(o.recordedAt).toLocaleString(),
      `${o.lying.systolic}/${o.lying.diastolic}`,
      `${standing3mReading(o)?.systolic ?? "—"}/${standing3mReading(o)?.diastolic ?? "—"}`,
      `${o.deltaSystolic}`,
      `${o.deltaDiastolic}`,
      o.positiveOrthostatic ? "Yes" : "No",
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: [254, 226, 226],
      textColor: [127, 29, 29],
      fontStyle: "bold",
    },
    theme: "plain",
  });

  nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Home BP spot checks", 14, nextY + 12);
  autoTable(doc, {
    startY: nextY + 16,
    head: [["Date / time", "Systolic", "Diastolic", "HR", "Notes"]],
    body: bundle.vitals.slice(0, 60).map((v) => [
      new Date(v.recordedAt).toLocaleString(),
      String(v.systolic),
      String(v.diastolic),
      v.heartRate != null ? String(v.heartRate) : "—",
      v.notes ?? "",
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    theme: "plain",
  });

  nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.text("Metabolic pathway / safety gate events (CYP bottlenecks)", 14, nextY + 12);
  autoTable(doc, {
    startY: nextY + 16,
    head: [["Date", "Pathway", "Inhibitor added", "Blocked substrate"]],
    body: bundle.safetyGateBlocks.slice(0, 40).map((b) => [
      new Date(b.recordedAt).toLocaleString(),
      b.pathway,
      b.draftInhibitorName,
      b.blockedSubstrateName,
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    theme: "plain",
  });

  nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.text("Post-dose tolerability (recent)", 14, nextY + 12);
  autoTable(doc, {
    startY: nextY + 16,
    head: [["Date", "Medication", "Symptoms"]],
    body: bundle.sideEffectLogs.slice(0, 40).map((s) => [
      new Date(s.recordedAt).toLocaleString(),
      s.medicationName,
      s.symptoms.join(", "),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    theme: "plain",
  });

  nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;

  const sketchLogs = bundle.dailyLogs.filter(
    (l) => l.sketchPngBase64 && l.sketchPngBase64.length > 80
  );

  const thumbW = 75;
  const thumbH = 100;
  let imgY = 24;
  let imgX = 14;

  if (sketchLogs.length > 0) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(
      0,
      0,
      pageW,
      doc.internal.pageSize.getHeight(),
      "F"
    );
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Body symptom sketches (${sketchLogs.length} from daily log)`,
      14,
      16
    );
    imgY = 28;
    imgX = 14;
  }

  for (let i = 0; i < Math.min(sketchLogs.length, 8); i++) {
    const s = sketchLogs[i];
    if (imgY + thumbH > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(
        0,
        0,
        pageW,
        doc.internal.pageSize.getHeight(),
        "F"
      );
      imgY = 20;
      imgX = 14;
    }
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `${s.sketchSide ?? "?"} · ${s.sketchBrushPreset ?? "?"} · ${new Date(s.recordedAt).toLocaleString()}`,
      imgX,
      imgY - 2
    );
    try {
      doc.addImage(
        `data:image/png;base64,${s.sketchPngBase64}`,
        "PNG",
        imgX,
        imgY,
        thumbW,
        thumbH
      );
    } catch {
      doc.text("(Sketch image could not be embedded)", imgX, imgY + 10);
    }
    imgX += thumbW + 10;
    if (imgX + thumbW > pageW - 14) {
      imgX = 14;
      imgY += thumbH + 16;
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "MedTracker local export · verify against formal medical records · Body sketches are patient-drawn overlays for symptom localization.",
    14,
    doc.internal.pageSize.getHeight() - 12,
    { maxWidth: pageW - 28 }
  );

  doc.save(
    `medtracker-doctor-report-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}
