/**
 * Temporary env probe — server/build snapshot (literal `process.env` reads).
 * Composed from `page.tsx` into auth UI when cloud sync is off.
 */
export default function AuthEnvDebugBridge() {
  return (
    <div className="mb-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
      <p className="mb-1 font-semibold uppercase tracking-wide text-slate-600">
        Build / SSR
      </p>
      <p>
        URL Present:{" "}
        {!!process.env.NEXT_PUBLIC_SUPABASE_URL ? "YES" : "NO"}
      </p>
      <p>
        Key Present:{" "}
        {!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "YES" : "NO"}
      </p>
    </div>
  );
}
