/**
 * Server/middleware Supabase config — literal `process.env.NEXT_PUBLIC_*` access only
 * (dynamic `process.env[name]` is not inlined into the client bundle).
 */
export function getSupabasePublicConfig(): {
  url: string;
  anonKey: string;
  configured: boolean;
} {
  const urlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keyRaw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url = typeof urlRaw === "string" ? urlRaw.trim() : "";
  const anonKey = typeof keyRaw === "string" ? keyRaw.trim() : "";
  return {
    url,
    anonKey,
    configured: url.length > 0 && anonKey.length > 0,
  };
}
