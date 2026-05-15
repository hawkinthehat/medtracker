/** Safe reads for public env vars — never throws during SSG/build when unset. */
export function publicEnv(name: string): string {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

export function getSupabasePublicConfig(): {
  url: string;
  anonKey: string;
  configured: boolean;
} {
  const url = publicEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = publicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return {
    url,
    anonKey,
    configured: url.length > 0 && anonKey.length > 0,
  };
}
