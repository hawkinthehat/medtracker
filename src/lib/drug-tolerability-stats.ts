import type { SideEffectLog } from "@/lib/types";

export function symptomIncludesDizziness(symptoms: string[]): boolean {
  return symptoms.some((s) => s.trim().toLowerCase() === "dizziness");
}

export type DoseGroupStats = {
  doseLabel: string;
  totalLogs: number;
  dizzinessCount: number;
  dizzinessPct: number | null;
};

export type MedicationTolerabilityGroup = {
  medicationId: string;
  medicationName: string;
  totalLogs: number;
  dizzinessCount: number;
  dizzinessPct: number | null;
  byDose: DoseGroupStats[];
};

function pct(count: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((count / total) * 1000) / 10;
}

function doseSortKey(label: string): string {
  if (label === "(unspecified dose)") return "\uffff";
  return label.toLowerCase();
}

export function groupSideEffectLogsForTolerability(
  logs: SideEffectLog[]
): MedicationTolerabilityGroup[] {
  const medKey = (log: SideEffectLog) =>
    log.medicationId?.trim() || log.medicationName.trim();

  const byMed = new Map<string, SideEffectLog[]>();
  for (const log of logs) {
    const key = medKey(log);
    const arr = byMed.get(key) ?? [];
    arr.push(log);
    byMed.set(key, arr);
  }

  const groups: MedicationTolerabilityGroup[] = [];

  for (const [, rows] of Array.from(byMed.entries())) {
    const first = rows[0];
    const medicationId = first.medicationId?.trim() || first.medicationName;
    const medicationName = first.medicationName.trim();

    const doseMap = new Map<string, SideEffectLog[]>();
    for (const log of rows) {
      const raw = log.doseLabel?.trim();
      const dk = raw ? raw : "(unspecified dose)";
      const arr = doseMap.get(dk) ?? [];
      arr.push(log);
      doseMap.set(dk, arr);
    }

    const totalLogs = rows.length;
    const dizzinessCount = rows.filter((log: SideEffectLog) =>
      symptomIncludesDizziness(log.symptoms)
    ).length;

    const byDose: DoseGroupStats[] = [];

    for (const [doseLabel, doseRows] of Array.from(doseMap.entries())) {
      const dTotal = doseRows.length;
      const dDiz = doseRows.filter((log: SideEffectLog) =>
        symptomIncludesDizziness(log.symptoms)
      ).length;
      byDose.push({
        doseLabel,
        totalLogs: dTotal,
        dizzinessCount: dDiz,
        dizzinessPct: pct(dDiz, dTotal),
      });
    }

    byDose.sort((a, b) =>
      doseSortKey(a.doseLabel).localeCompare(doseSortKey(b.doseLabel))
    );

    groups.push({
      medicationId,
      medicationName,
      totalLogs,
      dizzinessCount,
      dizzinessPct: pct(dizzinessCount, totalLogs),
      byDose,
    });
  }

  groups.sort((a, b) =>
    a.medicationName.localeCompare(b.medicationName, undefined, {
      sensitivity: "base",
    })
  );

  return groups;
}
