"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { formatDoseLabel } from "@/lib/medication-profile-types";
import type {
  MedicationHistoryEntry,
  MedicationProfile,
} from "@/lib/medication-profile-types";
import { calendarDayKeyLocal } from "@/lib/medication-active";
import { setMedicationsAndPersist } from "@/lib/medications-persist";
import { qk } from "@/lib/query-keys";
import type { SavedMedication } from "@/lib/seed-medications";
import { insertMedicationHistoryRow } from "@/lib/supabase/medication-history";

/**
 * When a temporary med passes its end date, log one `course_end` row to
 * `medication_history` and mark the local record so we do not duplicate inserts.
 */
export default function MedicationExpiryWatcher() {
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const meds = qc.getQueryData<SavedMedication[]>(qk.medications);
      if (!meds?.length) return;

      const todayKey = calendarDayKeyLocal();
      const profiles =
        qc.getQueryData<Record<string, MedicationProfile>>(
          qk.medicationProfiles,
        ) ?? {};

      const updates = new Map<string, SavedMedication>();
      const historyEntries: MedicationHistoryEntry[] = [];

      for (const m of meds) {
        if (
          !m.isTemporary ||
          !m.tempEndDate ||
          m.tempCourseEndLogged ||
          m.tempEndDate >= todayKey
        ) {
          continue;
        }

        const profile = profiles[m.id];
        const oldLabel = profile
          ? formatDoseLabel(profile.doseValue, profile.doseUnit)
          : (m.doseLabel ?? null);

        const entryId = crypto.randomUUID();
        const recordedAt = new Date().toISOString();
        const ok = await insertMedicationHistoryRow({
          id: entryId,
          medicationId: m.id,
          medicationName: m.name,
          recordedAt,
          changeKind: "course_end",
          oldDoseLabel: oldLabel,
          newDoseLabel: null,
          oldScheduledTimes: profile?.scheduledTimes ?? null,
          newScheduledTimes: null,
          reason: `Temporary course completed (scheduled ${m.tempStartDate ?? "?"} → ${m.tempEndDate}).`,
        });

        if (!ok || cancelled) continue;

        historyEntries.push({
          id: entryId,
          medicationId: m.id,
          medicationName: m.name,
          recordedAt,
          changeKind: "course_end",
          oldDoseLabel: oldLabel,
          newDoseLabel: null,
          oldScheduledTimes: profile?.scheduledTimes ?? null,
          newScheduledTimes: null,
          reason: `Temporary course completed (scheduled ${m.tempStartDate ?? "?"} → ${m.tempEndDate}).`,
        });

        updates.set(m.id, { ...m, tempCourseEndLogged: true });
      }

      if (cancelled) return;

      if (historyEntries.length > 0) {
        qc.setQueryData<MedicationHistoryEntry[]>(
          qk.medicationHistory,
          (prev = []) => [...historyEntries, ...prev],
        );
      }

      if (updates.size > 0) {
        setMedicationsAndPersist(qc, (prev) =>
          prev.map((x) => updates.get(x.id) ?? x),
        );
      }
    }

    void tick();
    const intervalId = window.setInterval(() => void tick(), 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [qc]);

  return null;
}
