"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { qk } from "@/lib/query-keys";
import type {
  ClinicalSnapshotsMap,
  JournalEntry,
  OrthostaticSession,
  VitalRow,
} from "@/lib/types";
import {
  buildClinicalCorrelationSnapshot,
  todayLocalDateKey,
} from "@/lib/clinical-correlation";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";

/**
 * Runs the nightly (local 9:00 PM) clinical correlation once per calendar day
 * when the app is open, using persisted vitals / logs / journal from the cache.
 */
export default function ClinicalCorrelationScheduler() {
  const qc = useQueryClient();

  useQuery({
    queryKey: qk.clinicalSnapshots,
    queryFn: async (): Promise<ClinicalSnapshotsMap> => ({}),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: vitals = [] } = useQuery({
    queryKey: qk.vitals,
    queryFn: async (): Promise<VitalRow[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: orthostatic = [] } = useQuery({
    queryKey: qk.orthostatic,
    queryFn: async (): Promise<OrthostaticSession[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const { data: dailyLogs = [] } = useQuery({
    queryKey: qk.dailyLogs,
    queryFn: dailyLogsQueryFn,
    staleTime: 60_000,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: journal = [] } = useQuery({
    queryKey: qk.journal,
    queryFn: async (): Promise<JournalEntry[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    function tick() {
      const now = new Date();
      if (now.getHours() < 21) return;

      const todayKey = todayLocalDateKey();
      const snapMap =
        qc.getQueryData<ClinicalSnapshotsMap>(qk.clinicalSnapshots) ?? {};
      const existing = snapMap[todayKey];
      if (existing?.locked) return;
      if (existing?.trigger === "scheduled_21_00") return;

      const snap = buildClinicalCorrelationSnapshot({
        dateKey: todayKey,
        vitals,
        orthostatic,
        dailyLogs,
        journal,
        trigger: "scheduled_21_00",
        previous: existing ?? null,
      });

      qc.setQueryData<ClinicalSnapshotsMap>(qk.clinicalSnapshots, (prev = {}) => ({
        ...prev,
        [todayKey]: snap,
      }));
    }

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [qc, vitals, orthostatic, dailyLogs, journal]);

  return null;
}
