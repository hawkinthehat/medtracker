import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

/** Browser Supabase client — uses cookies so middleware + server stay in sync with auth. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const { url, anonKey: key, configured } = getSupabasePublicConfig();
  if (!configured) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
