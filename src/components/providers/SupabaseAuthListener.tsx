"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { qk, REACT_QUERY_PERSIST_LOCAL_STORAGE_KEY } from "@/lib/query-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

/**
 * Subscribes to `supabase.auth.onAuthStateChange` so UI and React Query stay in
 * sync when the session is restored from cookies (new tab), refreshed, or ends.
 */
export default function SupabaseAuthListener() {
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        try {
          qc.clear();
        } catch (e) {
          console.warn("[auth] query cache clear after sign-out:", e);
        }
        try {
          window.localStorage.removeItem(REACT_QUERY_PERSIST_LOCAL_STORAGE_KEY);
        } catch {
          /* private mode / blocked storage */
        }
      }

      void qc.invalidateQueries({ queryKey: qk.dailyLogs, exact: true });
      void qc.invalidateQueries({ queryKey: qk.hydrationTotalsTodayRoot });

      const refreshShell =
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED" ||
        event === "INITIAL_SESSION";

      if (refreshShell) {
        void qc.invalidateQueries({ queryKey: qk.medicationLogs });
        void qc.invalidateQueries({ queryKey: qk.medications });
        void qc.invalidateQueries({ queryKey: qk.symptomLogs });
        void qc.invalidateQueries({ queryKey: qk.activityToday });
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [qc, router]);

  return null;
}
