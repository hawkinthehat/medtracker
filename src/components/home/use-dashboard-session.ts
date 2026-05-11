"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { qk } from "@/lib/query-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

/**
 * Session + Supabase availability for the home dashboard (auth gate + gated widgets).
 */
export function useDashboardSession() {
  const router = useRouter();
  const qc = useQueryClient();
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    if (!sb) {
      setSessionUser(null);
      setSessionResolved(true);
      return;
    }
    void sb.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user ?? null);
      setSessionResolved(true);
    });
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event, session) => {
      setSessionUser(session?.user ?? null);
      setSessionResolved(true);
      if (event === "SIGNED_IN") {
        router.refresh();
        void qc.invalidateQueries({ queryKey: qk.dailyLogs });
        void qc.invalidateQueries({ queryKey: qk.medicationLogs });
        void qc.invalidateQueries({ queryKey: qk.activityToday });
      }
    });
    return () => subscription.unsubscribe();
  }, [qc, router]);

  const supabaseConfigured = Boolean(getSupabaseBrowserClient());
  const showAuthGate =
    supabaseConfigured && sessionResolved && sessionUser === null;
  const countersEnabled =
    sessionResolved && supabaseConfigured && sessionUser !== null;

  return { showAuthGate, countersEnabled };
}
