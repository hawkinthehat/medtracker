"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { qk } from "@/lib/query-keys";
import { fetchMedicationsQuery } from "@/lib/medications-query";
import type { SavedMedication } from "@/lib/seed-medications";
import { fetchMedicationHistoryFromSupabase } from "@/lib/supabase/medication-history";
import { fetchMedicationLogsFromSupabase } from "@/lib/supabase/medication-logs";
import { dailyLogsQueryFn } from "@/lib/daily-logs-query-fn";
import type {
  DailyLogEntry,
  OrthostaticSession,
  SafetyGateBlockEvent,
  SideEffectLog,
  VitalRow,
} from "@/lib/types";
import type { MedicationHistoryEntry } from "@/lib/medication-profile-types";
import type { MedicationLogRow } from "@/lib/supabase/medication-logs";
import { generateDoctorSpecialistPdf } from "@/lib/pdf-export";

export default function DoctorReportPage() {
  const qc = useQueryClient();

  useQuery({
    queryKey: qk.medications,
    queryFn: fetchMedicationsQuery,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  useQuery({
    queryKey: qk.medicationHistory,
    queryFn: fetchMedicationHistoryFromSupabase,
    staleTime: 60_000,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
  });

  useQuery({
    queryKey: qk.orthostatic,
    queryFn: async (): Promise<OrthostaticSession[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  useQuery({
    queryKey: qk.vitals,
    queryFn: async (): Promise<VitalRow[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  useQuery({
    queryKey: qk.dailyLogs,
    queryFn: dailyLogsQueryFn,
    staleTime: 60_000,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  useQuery({
    queryKey: qk.safetyGateBlocks,
    queryFn: async (): Promise<SafetyGateBlockEvent[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  useQuery({
    queryKey: qk.sideEffectLogs,
    queryFn: async (): Promise<SideEffectLog[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  useQuery({
    queryKey: qk.medicationLogs,
    queryFn: () => fetchMedicationLogsFromSupabase(),
    staleTime: 30_000,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: true,
  });

  const exportPdf = useMutation({
    mutationFn: async () => {
      const medications =
        qc.getQueryData<SavedMedication[]>(qk.medications) ?? [];
      let medicationHistory = qc.getQueryData<MedicationHistoryEntry[]>(
        qk.medicationHistory,
      );
      if (medicationHistory === undefined) {
        medicationHistory = await fetchMedicationHistoryFromSupabase();
      }
      const orthostatic =
        qc.getQueryData<OrthostaticSession[]>(qk.orthostatic) ?? [];
      const vitals = qc.getQueryData<VitalRow[]>(qk.vitals) ?? [];
      const dailyLogs =
        qc.getQueryData<DailyLogEntry[]>(qk.dailyLogs) ?? [];
      const safetyGateBlocks =
        qc.getQueryData<SafetyGateBlockEvent[]>(qk.safetyGateBlocks) ?? [];
      const sideEffectLogs =
        qc.getQueryData<SideEffectLog[]>(qk.sideEffectLogs) ?? [];
      let medicationLogs =
        qc.getQueryData<MedicationLogRow[]>(qk.medicationLogs);
      if (medicationLogs === undefined) {
        medicationLogs = await fetchMedicationLogsFromSupabase(200);
      }

      await generateDoctorSpecialistPdf({
        medications,
        medicationHistory,
        orthostatic,
        vitals,
        dailyLogs,
        safetyGateBlocks,
        sideEffectLogs,
        medicationLogs,
      });
    },
  });

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-16 pt-2">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Doctor report
      </h1>
      <p className="text-sm leading-relaxed text-slate-600">
        Compile medications, dose history, positional BP deltas, metabolic gate
        blocks, tolerability logs, and body sketches into one printable PDF for
        a new specialist.
      </p>
      <button
        type="button"
        onClick={() => exportPdf.mutate()}
        disabled={exportPdf.isPending}
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
      >
        <FileDown className="h-5 w-5" aria-hidden />
        {exportPdf.isPending ? "Building PDF…" : "Generate PDF"}
      </button>
      {exportPdf.isError && (
        <p className="text-sm font-medium text-red-700" role="alert">
          Could not generate PDF. Try again.
        </p>
      )}
    </div>
  );
}
