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
  const id = await resolveSupabaseUserId(sb);
  if (!id) {
    logDataNotSavedNoUser();
    return null;
  }
  return { id };
}

/**
 * Resolves the signed-in user id for browser reads/writes. If the first
 * {@link SupabaseClient.auth.getUser} call yields no user (expired access token,
 * tab restored after sleep, or split cookie state), runs one
 * {@link SupabaseClient.auth.refreshSession} and retries so PostgREST inserts
 * still send a valid JWT.
 */
export async function resolveSupabaseUserId(
  sb: SupabaseClient,
): Promise<string | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user?.id) return user.id;

  const { error: refreshError } = await sb.auth.refreshSession();
  if (refreshError) return null;

  const {
    data: { user: userAfter },
  } = await sb.auth.getUser();
  return userAfter?.id ?? null;
}

const g = globalThis;

/** Rejects if `promise` does not settle within `ms` (clears the timer on success/failure). */
export async function withTimeoutMs<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage = `Timed out after ${ms}ms`,
): Promise<T> {
  let timeoutId: ReturnType<typeof g.setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = g.setTimeout(() => reject(new Error(timeoutMessage)), ms);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) g.clearTimeout(timeoutId);
  }
}
