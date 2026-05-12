import type { SupabaseClient } from "@supabase/supabase-js";

/** Exact message requested for device debug logs when saves are skipped. */
export function logDataNotSavedNoUser(): void {
  console.error("Data not saved: User not logged in");
}

/**
 * Strict auth gate for **writes only**: uses {@link SupabaseClient.auth.getUser}
 * (no session fallback). Alerts if there is no logged-in user.
 */
export async function requireAuthUserForSave(
  sb: SupabaseClient,
): Promise<{ id: string } | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.id) {
    logDataNotSavedNoUser();
    return null;
  }
  return { id: user.id };
}

/**
 * Resolves the signed-in user id (getUser first, then session — helps mobile clients).
 */
export async function resolveSupabaseUserId(
  sb: SupabaseClient,
): Promise<string | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user?.id) return user.id;
  const {
    data: { session },
  } = await sb.auth.getSession();
  return session?.user?.id ?? null;
}
