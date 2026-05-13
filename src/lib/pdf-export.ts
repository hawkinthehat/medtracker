import type { MedicationHistoryEntry } from "@/lib/medication-profile-types";
import type { MedicationLogRow } from "@/lib/supabase/medication-logs";
import type { SymptomLogRow } from "@/lib/supabase/symptom-logs";
import {
  buildFibromyalgiaTrendsSummary,
  buildSymptomMatrixRollingSevenDaySummary,
} from "@/lib/symptom-matrix-report";
import {
  caffeineMgFromEntry,
  formatCaffeineReportSummary,
  recentCaffeineLogRows,
} from "@/lib/caffeine-intake";
import {
  calendarDayKeyLocal,
  getActiveMedications,
  getRecentlyCompletedTemporaryMedications,
} from "@/lib/medication-active";
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
import { findSuspectedFoodTriggerFoodIds } from "@/lib/trigger-finder";
import { localDateKeyFromIso } from "@/lib/clinical-correlation";
import type { jsPDF } from "jspdf";

type PdfWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

function orthostaticClinicalFlags(o: OrthostaticSession): string {
  const oh = o.positiveOrthostatic;
  const pots = Boolean(o.potsSuspect);
  if (oh && pots) return "OH + POTS";
  if (oh) return "OH";
  if (pots) return "POTS";
  return "—";
}

function orthostaticGearYesNo(v: boolean | undefined): string {
  if (v === undefined) return "—";
  return v ? "Yes" : "No";
}

function orthostaticRowFlagged(o: OrthostaticSession): boolean {
  return Boolean(o.positiveOrthostatic || o.potsSuspect);
}

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
    "Rows may highlight when ΔBP suggests orthostatic hypotension (OH) or ΔHR suggests a POTS pattern — gear columns show compression use.",
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
        "Flags",
        "Compress",
        "Binder",
      ],
    ],
    body: ortho.map((o) => [
      new Date(o.recordedAt).toLocaleString(),
      `${o.lying.systolic}/${o.lying.diastolic}`,
      `${o.sitting.systolic}/${o.sitting.diastolic}`,
      `${standing3mReading(o)?.systolic ?? "—"}/${standing3mReading(o)?.diastolic ?? "—"}`,
      `${o.deltaSystolic}`,
      `${o.deltaDiastolic}`,
      orthostaticClinicalFlags(o),
      orthostaticGearYesNo(o.compressionGarment),
      orthostaticGearYesNo(o.abdominalBinder),
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
      if (!session || !orthostaticRowFlagged(session)) return;
      data.cell.styles.fillColor = [254, 226, 226];
      data.cell.styles.textColor = [127, 29, 29];
      if (data.column.index === 6) data.cell.styles.fontStyle = "bold";
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
        "Flags",
        "Compress",
        "Binder",
      ],
    ],
    body: ortho.map((o) => [
      new Date(o.recordedAt).toLocaleString(),
      `${o.lying.systolic}/${o.lying.diastolic}`,
      `${standing3mReading(o)?.systolic ?? "—"}/${standing3mReading(o)?.diastolic ?? "—"}`,
      `${o.deltaSystolic}`,
      `${o.deltaDiastolic}`,
      orthostaticClinicalFlags(o),
      orthostaticGearYesNo(o.compressionGarment),
      orthostaticGearYesNo(o.abdominalBinder),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: [127, 29, 29],
      textColor: [254, 226, 226],
      fontStyle: "bold",
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const session = ortho[data.row.index];
      if (!session || !orthostaticRowFlagged(session)) return;
      data.cell.styles.fillColor = [254, 226, 226];
      data.cell.styles.textColor = [127, 29, 29];
      if (data.column.index === 5) data.cell.styles.fontStyle = "bold";
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
  /** Optional same-day symptom journal — combined with Symptom Matrix for food timing. */
  journal?: JournalEntry[];
  safetyGateBlocks: SafetyGateBlockEvent[];
  sideEffectLogs: SideEffectLog[];
  medicationLogs: MedicationLogRow[];
  /** Quick-tap Symptom Matrix rows (`symptom_logs`) — summarized by category on the PDF. */
  symptomLogs: SymptomLogRow[];
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
  const todayKey = calendarDayKeyLocal();
  const activeMedicationRows = getActiveMedications(
    bundle.medications,
    todayKey,
  );
  const recentlyCompletedTemps = getRecentlyCompletedTemporaryMedications(
    bundle.medications,
    todayKey,
    90,
  );
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
    bundle.patientLabel ?? "Patient · MedTracker export",
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
    head: [["Medication", "Class / notes"]],
    body: activeMedicationRows.map((m) => [
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

  if (recentlyCompletedTemps.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Recently completed medications (temporary courses, last 90 days)", 14, nextY + 12);
    autoTable(doc, {
      startY: nextY + 16,
      head: [["Medication", "Start", "End", "Last dose line"]],
      body: recentlyCompletedTemps.map((m) => [
        m.name,
        m.tempStartDate ?? "—",
        m.tempEndDate ?? "—",
        m.doseLabel ?? "—",
      ]),
      styles: { fontSize: 8, cellPadding: 1.8, textColor: [15, 23, 42] },
      headStyles: {
        fillColor: [226, 232, 240],
        textColor: [15, 23, 42],
        fontStyle: "bold",
      },
      theme: "plain",
    });
    nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;
  }

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
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

  if (bundle.medicationLogs.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(
      "Quick relief (PRN) logs — symptom-map correlation",
      14,
      nextY + 12,
    );
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      "When a flare was marked on the body map within 30 minutes, Tiaki links the dose to that region for efficacy review.",
      14,
      nextY + 17,
      { maxWidth: 180 },
    );
    autoTable(doc, {
      startY: nextY + 22,
      head: [["Time", "Medication", "Dose", "AM/PM", "Symptom-map link"]],
      body: bundle.medicationLogs.slice(0, 60).map((l) => [
        new Date(l.recordedAt).toLocaleString(),
        l.medicationName,
        l.dosageLabel,
        l.period,
        l.linkSummary ?? "—",
      ]),
      styles: { fontSize: 7, cellPadding: 1.6, textColor: [15, 23, 42] },
      headStyles: {
        fillColor: [224, 231, 255],
        textColor: [15, 23, 42],
        fontStyle: "bold",
      },
      columnStyles: { 4: { cellWidth: 62 } },
      theme: "plain",
    });
    nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;
  }

  const symptomSummary = buildSymptomMatrixRollingSevenDaySummary(
    bundle.symptomLogs,
    new Date(bundle.compiledAt),
  );
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Symptom Matrix (quick taps) — rolling 7 days", 14, nextY + 12);
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(
    "Grouped by disorder bucket so specialists can scan flare frequency at a glance.",
    14,
    nextY + 17,
    { maxWidth: pageW - 28 },
  );
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  const symptomLines = doc.splitTextToSize(symptomSummary, pageW - 28);
  let symptomY = nextY + 26;
  symptomLines.forEach((line: string) => {
    doc.text(line, 14, symptomY);
    symptomY += 5;
  });
  doc.setFont("helvetica", "normal");
  nextY = symptomY + 6;

  const fibroTrends = buildFibromyalgiaTrendsSummary(
    bundle.symptomLogs,
    new Date(bundle.compiledAt),
  );
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Fibromyalgia trends (rolling 7 days)", 14, nextY + 12);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    "Pain vs stiffness frequency helps compare fibro clustering with dysautonomia flares and pressure-sensitive symptoms.",
    14,
    nextY + 17,
    { maxWidth: pageW - 28 },
  );
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  const fibroLines = doc.splitTextToSize(fibroTrends, pageW - 28);
  let fibroY = nextY + 26;
  fibroLines.forEach((line: string) => {
    doc.text(line, 14, fibroY);
    fibroY += 5;
  });
  doc.setFont("helvetica", "normal");
  nextY = fibroY + 6;

  doc.setFontSize(12);
  doc.setTextColor(120, 53, 15);
  doc.text("Caffeine intake", 14, nextY + 12);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const caffeineSummary = formatCaffeineReportSummary(
    bundle.dailyLogs,
    new Date(bundle.compiledAt),
  );
  const caffeineLines = doc.splitTextToSize(caffeineSummary, pageW - 28);
  let cafeY = nextY + 18;
  caffeineLines.forEach((line: string) => {
    doc.text(line, 14, cafeY);
    cafeY += 4.8;
  });
  nextY = cafeY + 4;

  const caffeineRows = recentCaffeineLogRows(bundle.dailyLogs, 35);
  if (caffeineRows.length > 0) {
    autoTable(doc, {
      startY: nextY + 4,
      head: [["Time", "Source", "Caffeine (mg)"]],
      body: caffeineRows.map((r) => [
        new Date(r.recordedAt).toLocaleString(),
        r.label,
        String(caffeineMgFromEntry(r)),
      ]),
      styles: { fontSize: 8, cellPadding: 1.8, textColor: [15, 23, 42] },
      headStyles: {
        fillColor: [254, 243, 199],
        textColor: [120, 53, 15],
        fontStyle: "bold",
      },
      theme: "plain",
    });
    nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;
  }

  const suspectedFoodIds = findSuspectedFoodTriggerFoodIds(
    bundle.dailyLogs,
    bundle.journal ?? [],
    bundle.symptomLogs,
  );
  const foodRows = [...bundle.dailyLogs]
    .filter((l) => l.category === "food")
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    )
    .slice(0, 45);
  if (foodRows.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(22, 101, 52);
    doc.text("Smart nutrition log (recent)", 14, nextY + 12);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      "kcal values are estimates. Amber rows: a symptom journal entry or Symptom Matrix tap occurred within 2 hours after that meal (timing only, not a diagnosis).",
      14,
      nextY + 17,
      { maxWidth: pageW - 28 },
    );
    autoTable(doc, {
      startY: nextY + 22,
      head: [["Time", "What you ate", "kcal", "Flare timing"]],
      body: foodRows.map((r) => {
        const desc = (r.notes ?? r.label ?? "").trim() || "—";
        const kcal =
          r.valueKcal != null && r.valueKcal > 0
            ? String(Math.round(r.valueKcal))
            : "—";
        const flagged = suspectedFoodIds.has(r.id);
        return [
          new Date(r.recordedAt).toLocaleString(),
          desc.length > 140 ? `${desc.slice(0, 137)}…` : desc,
          kcal,
          flagged ? "Symptom within 2h — review" : "—",
        ];
      }),
      styles: { fontSize: 8, cellPadding: 1.8, textColor: [15, 23, 42] },
      headStyles: {
        fillColor: [220, 252, 231],
        textColor: [22, 101, 52],
        fontStyle: "bold",
      },
      columnStyles: { 1: { cellWidth: 72 } },
      theme: "plain",
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const row = foodRows[data.row.index];
        if (!row || !suspectedFoodIds.has(row.id)) return;
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [120, 53, 15];
        if (data.column.index === 3) data.cell.styles.fontStyle = "bold";
      },
    });
    nextY = (doc as PdfWithAutoTable).lastAutoTable.finalY;
  }

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
        "Flags",
        "Compress",
        "Binder",
      ],
    ],
    body: bundle.orthostatic.slice(0, 40).map((o) => [
      new Date(o.recordedAt).toLocaleString(),
      `${o.lying.systolic}/${o.lying.diastolic}`,
      `${standing3mReading(o)?.systolic ?? "—"}/${standing3mReading(o)?.diastolic ?? "—"}`,
      `${o.deltaSystolic}`,
      `${o.deltaDiastolic}`,
      orthostaticClinicalFlags(o),
      orthostaticGearYesNo(o.compressionGarment),
      orthostaticGearYesNo(o.abdominalBinder),
    ]),
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: {
      fillColor: [254, 226, 226],
      textColor: [127, 29, 29],
      fontStyle: "bold",
    },
    theme: "plain",
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const rows = bundle.orthostatic.slice(0, 40);
      const session = rows[data.row.index];
      if (!session || !orthostaticRowFlagged(session)) return;
      data.cell.styles.fillColor = [254, 226, 226];
      data.cell.styles.textColor = [127, 29, 29];
      if (data.column.index === 5) data.cell.styles.fontStyle = "bold";
    },
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
  doc.text("Side effects after doses (recent)", 14, nextY + 12);
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
      `${s.sketchSide ?? "?"} · ${new Date(s.recordedAt).toLocaleString()}`,
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
