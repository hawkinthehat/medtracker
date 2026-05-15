import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client — uses `@supabase/ssr` `createBrowserClient` with the
 * **same** public credentials as `NEXT_PUBLIC_SUPABASE_URL` and
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY`:
 *
 * 1. Read from `process.env.NEXT_PUBLIC_*` (inlined at build time when set).
 * 2. If either is empty in the client bundle, read `window.__TIAKI_SUPABASE_PUBLIC__`
 *    set by the root layout from **server** `process.env` at request time (Vercel).
 *
 * No alternate env names, no hard-coded keys, no `createClient` from `@supabase/supabase-js`.
 */

let browserClient: SupabaseClient | null = null;

function readInjectedPublic(): { url: string; anonKey: string } | null {
  if (typeof window === "undefined") return null;
  const inj = window.__TIAKI_SUPABASE_PUBLIC__;
  if (!inj) return null;
  const url = typeof inj.url === "string" ? inj.url.trim() : "";
  const anonKey = typeof inj.anonKey === "string" ? inj.anonKey.trim() : "";
  if (url.length === 0 || anonKey.length === 0) return null;
  return { url, anonKey };
}

/**
 * Must use literal `process.env.NEXT_PUBLIC_*` so Next can inline at build time.
 * When empty there, the root layout mirrors the same vars into `window.__TIAKI_SUPABASE_PUBLIC__`.
 */
function supabaseUrlFromProcessEnv(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return typeof raw === "string" ? raw.trim() : "";
}

function supabaseAnonKeyFromProcessEnv(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return typeof raw === "string" ? raw.trim() : "";
}

function supabaseUrlResolved(): string {
  const fromEnv = supabaseUrlFromProcessEnv();
  if (fromEnv.length > 0) return fromEnv;
  return readInjectedPublic()?.url ?? "";
}

function supabaseAnonKeyResolved(): string {
  const fromEnv = supabaseAnonKeyFromProcessEnv();
  if (fromEnv.length > 0) return fromEnv;
  return readInjectedPublic()?.anonKey ?? "";
}

/** True when URL and anon key are available (build-inlined and/or layout-injected). */
export function isSupabaseConfigured(): boolean {
  return (
    supabaseUrlResolved().length > 0 && supabaseAnonKeyResolved().length > 0
  );
}

/** Browser Supabase client — cookies stay aligned with middleware + server. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  const url = supabaseUrlResolved();
  const key = supabaseAnonKeyResolved();

  if (!browserClient) {
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
