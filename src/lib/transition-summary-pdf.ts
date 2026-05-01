import type { SavedMedication } from "@/lib/seed-medications";
import {
  averageOrthostaticDeltaLastDays,
  rollingAverageBrainFog7d,
  rollingAverageMood7d,
} from "@/lib/clinical-summary-stats";
import type {
  BrainFogEntry,
  MoodEntry,
  OrthostaticSession,
  SafetyGateBlockEvent,
} from "@/lib/types";

export async function generateTransitionClinicalPdf(params: {
  medications: SavedMedication[];
  safetyGateBlocks: SafetyGateBlockEvent[];
  orthostatic: OrthostaticSession[];
  moods: MoodEntry[];
  brainFog: BrainFogEntry[];
}): Promise<void> {
  const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);

  const title =
    "Patient Health Summary: Jade - Transition to Missouri Specialty Care";

  const orthoAvg = averageOrthostaticDeltaLastDays(params.orthostatic, 7);
  const moodAvg = rollingAverageMood7d(params.moods);
  const fogAvg = rollingAverageBrainFog7d(params.brainFog);

  const cypBlocks = params.safetyGateBlocks.filter(
    (e) => e.pathway === "CYP3A4"
  );

  const doc = new jsPDF({ unit: "mm", format: "letter" });
  let y = 18;

  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, y, { maxWidth: 180 });
  y += 12;

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
  y += 8;

  doc.setTextColor(51, 65, 85);
  doc.text(
    "Clinical summary for care coordination during transition to Missouri specialty care. Not a substitute for the medical record.",
    14,
    y,
    { maxWidth: 180 }
  );
  y += 14;

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Seven-day rolling averages", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(52, 72, 92);
  doc.text(
    `Mood (1–5 scale): ${moodAvg != null ? moodAvg.toFixed(2) : "— (no entries)"}`,
    14,
    y
  );
  y += 5;
  doc.text(
    `Brain fog (1–10, higher = worse): ${fogAvg != null ? fogAvg.toFixed(2) : "— (no entries)"}`,
    14,
    y
  );
  y += 10;

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Orthostatic blood pressure — average delta (lying − standing)", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(52, 72, 92);
  if (orthoAvg.count === 0) {
    doc.text(
      "No guided orthostatic sessions with standing readings in the last 7 days.",
      14,
      y,
      { maxWidth: 180 }
    );
    y += 8;
  } else {
    doc.text(
      `Sessions included: ${orthoAvg.count}. Mean Δ systolic: ${orthoAvg.meanDeltaSystolic?.toFixed(1) ?? "—"} mmHg · Mean Δ diastolic: ${orthoAvg.meanDeltaDiastolic?.toFixed(1) ?? "—"} mmHg.`,
      14,
      y,
      { maxWidth: 180 }
    );
    y += 12;
  }

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Current medication list", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(52, 72, 92);
  if (params.medications.length === 0) {
    doc.text("No medications listed.", 14, y);
    y += 8;
  } else {
    for (const m of params.medications) {
      const line = `${m.name} — ${m.pathway}${m.pathway_role ? ` (${m.pathway_role})` : ""}`;
      doc.text(line, 14, y, { maxWidth: 180 });
      y += 5;
      if (y > 260) {
        doc.addPage();
        y = 16;
      }
    }
    y += 6;
  }

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("CYP3A4 bottleneck history (safety gate blocks)", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(52, 72, 92);
  if (cypBlocks.length === 0) {
    doc.text(
      "No blocked inhibitor/substrate events recorded on the CYP3A4 pathway.",
      14,
      y,
      { maxWidth: 180 }
    );
  } else {
    for (const b of cypBlocks) {
      const line = `${new Date(b.recordedAt).toLocaleString()} — proposed inhibitor “${b.draftInhibitorName}” vs substrate “${b.blockedSubstrateName}”.`;
      doc.text(line, 14, y, { maxWidth: 180 });
      y += 6;
      if (y > 265) {
        doc.addPage();
        y = 16;
      }
    }
  }

  doc.save(
    `patient-health-summary-jade-missouri-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}
