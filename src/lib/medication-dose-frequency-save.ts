import type { QueryClient } from "@tanstack/react-query";
import type {
  MedicationHistoryEntry,
  MedicationProfile,
  DoseUnit,
} from "@/lib/medication-profile-types";
import { formatDoseLabel } from "@/lib/medication-profile-types";
import { qk } from "@/lib/query-keys";
import type { FrequencyHint, SavedMedication } from "@/lib/seed-medications";
import { setMedicationsAndPersist } from "@/lib/medications-persist";
import {
  insertMedicationHistoryRow,
  upsertMedicationProfileRemote,
} from "@/lib/supabase/medication-history";
import { upsertUserMedicationRemote } from "@/lib/supabase/user-medications";
import { upsertPublicMedicationRemote } from "@/lib/supabase/medications-timeline";

const FREQUENCY_LABELS: Record<FrequencyHint, string> = {
  "1x": "1× daily",
  "2x": "2× daily",
  "3x": "3× daily",
  prn: "PRN",
};

export function timesForFrequency(
  fh: FrequencyHint,
  existing?: MedicationProfile,
): string[] {
  const t0 = existing?.scheduledTimes?.[0];
  const okTime = t0 && /^\d{2}:\d{2}$/.test(t0) ? t0 : undefined;
  switch (fh) {
    case "1x":
      return [okTime ?? "20:00"];
    case "2x":
      return okTime ? [okTime, "20:00"] : ["08:00", "20:00"];
    case "3x":
      return ["08:00", "14:00", "20:00"];
    case "prn":
      return [okTime ?? "12:00"];
    default:
      return ["20:00"];
  }
}

export function buildDoseFrequencyDisplayLine(
  doseValue: number,
  doseUnit: DoseUnit,
  fh: FrequencyHint,
): string {
  return `${formatDoseLabel(doseValue, doseUnit)} · ${FREQUENCY_LABELS[fh]}`;
}

export async function persistMedicationDoseFrequencyChange(
  qc: QueryClient,
  params: {
    med: SavedMedication;
    doseValue: number;
    doseUnit: DoseUnit;
    frequencyHint: FrequencyHint;
    profiles: Record<string, MedicationProfile>;
    historyReason?: string;
  },
): Promise<void> {
  const {
    med,
    doseValue,
    doseUnit,
    frequencyHint,
    profiles,
    historyReason = "Medication edit",
  } = params;
  const prevProfile = profiles[med.id];
  const oldLabel = prevProfile
    ? formatDoseLabel(prevProfile.doseValue, prevProfile.doseUnit)
    : med.doseLabel ?? null;
  const newLabel = formatDoseLabel(doseValue, doseUnit);
  const newTimes = timesForFrequency(frequencyHint, prevProfile);

  const doseChanged =
    !prevProfile ||
    prevProfile.doseValue !== doseValue ||
    prevProfile.doseUnit !== doseUnit;
  const timeChanged =
    !prevProfile ||
    JSON.stringify(prevProfile.scheduledTimes ?? []) !==
      JSON.stringify(newTimes);
  const freqChanged = (med.frequencyHint ?? "2x") !== frequencyHint;

  let changeKind: MedicationHistoryEntry["changeKind"] = "dose_time";
  if (doseChanged && !timeChanged && !freqChanged) changeKind = "dose";
  else if (!doseChanged && timeChanged && !freqChanged) changeKind = "time";

  const entry: MedicationHistoryEntry = {
    id: crypto.randomUUID(),
    medicationId: med.id,
    medicationName: med.name,
    recordedAt: new Date().toISOString(),
    changeKind,
    oldDoseLabel: oldLabel,
    newDoseLabel: newLabel,
    oldScheduledTimes: prevProfile?.scheduledTimes ?? null,
    newScheduledTimes: newTimes,
    reason: historyReason,
  };

  const nextProfile: MedicationProfile = {
    doseValue,
    doseUnit,
    scheduledTimes: newTimes,
  };

  await insertMedicationHistoryRow(entry);
  await upsertMedicationProfileRemote(med.id, nextProfile);

  const displayLine = buildDoseFrequencyDisplayLine(
    doseValue,
    doseUnit,
    frequencyHint,
  );

  qc.setQueryData<MedicationHistoryEntry[]>(
    qk.medicationHistory,
    (prev = []) => [entry, ...prev],
  );
  qc.setQueryData<Record<string, MedicationProfile>>(
    qk.medicationProfiles,
    (prev = {}) => ({
      ...prev,
      [med.id]: nextProfile,
    }),
  );
  setMedicationsAndPersist(qc, (prev = []) =>
    prev.map((x) =>
      x.id === med.id
        ? {
            ...x,
            doseLabel: displayLine,
            frequencyHint,
          }
        : x,
    ),
  );
  const updated: SavedMedication = {
    ...med,
    doseLabel: displayLine,
    frequencyHint,
  };
  await upsertUserMedicationRemote(updated);
  await upsertPublicMedicationRemote(updated, newTimes);

  await qc.invalidateQueries({ queryKey: qk.medicationTimeline });
  await qc.invalidateQueries({ queryKey: qk.medicationProfiles });
  await qc.invalidateQueries({ queryKey: qk.medications });
}
