import type { SupabaseClient } from "@supabase/supabase-js";

/** Exact message requested for device debug logs when saves are skipped. */
export function logDataNotSavedNoUser(): void {
  console.error("Data not saved: User not logged in");
}

/** Shown when JWT is gone or `user_id` cannot be resolved for Supabase writes. */
export const SESSION_EXPIRED_SAVE_TOAST =
  "Session expired. Please log in again to save your progress.";

/**
 * Maps persistence errors to a user-facing toast. Covers expired sessions and
 * orphaned `user_id` FK failures when the client cache still looked signed in.
 */
export function toastMessageForPersistFailure(errorMessage: string): string {
  const m = errorMessage.toLowerCase();
  if (
    errorMessage === "not_signed_in" ||
    m.includes("jwt expired") ||
    m.includes("invalid jwt") ||
    m.includes("auth session missing") ||
    m.includes("refresh token") ||
    m.includes("session expired") ||
    (m.includes("foreign key") &&
      (m.includes("user_id") || m.includes("daily_logs_user_id")))
  ) {
    return SESSION_EXPIRED_SAVE_TOAST;
  }
  return errorMessage;
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
 * Resolves the signed-in user id using {@link SupabaseClient.auth.getUser} only
 * (no `getSession` fallback) so reads match valid JWTs and FK-safe writes.
 */
export async function resolveSupabaseUserId(
  sb: SupabaseClient,
): Promise<string | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.id ?? null;
}
