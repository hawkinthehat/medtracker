import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Read public Supabase URL — must use a literal `process.env.NEXT_PUBLIC_*` property
 * so Next.js inlines the value into the client bundle at build time.
 */
function supabaseUrlFromEnv(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return typeof raw === "string" ? raw.trim() : "";
}

function supabaseAnonKeyFromEnv(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Both vars set and non-empty after trim (not "missing during build" empty strings). */
export function isSupabaseConfigured(): boolean {
  return (
    supabaseUrlFromEnv().length > 0 && supabaseAnonKeyFromEnv().length > 0
  );
}

/** Browser Supabase client — uses cookies so middleware + server stay in sync with auth. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  const url = supabaseUrlFromEnv();
  const key = supabaseAnonKeyFromEnv();

  if (!browserClient) {
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
