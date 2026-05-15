"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { safeInternalPath } from "@/lib/auth/safe-redirect";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/browser-client";

type Mode = "signup" | "signin";

type AuthPageContentProps = {
  /** Temporary: server env probe from `page.tsx` (see AuthEnvDebugBridge). */
  envDebugSlot?: ReactNode;
};

export default function AuthPageContent({
  envDebugSlot,
}: AuthPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeInternalPath(searchParams.get("next"));

  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabaseConfigured = isSupabaseConfigured();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const sb = getSupabaseBrowserClient();
    if (!sb) {
      setError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
      );
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter email and password.");
      return;
    }

    if (mode === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error: authError } = await sb.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (authError) throw authError;
      } else {
        const { error: authError } = await sb.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (authError) throw authError;
      }

      router.replace(nextPath);
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black tracking-tight text-black">
          MedTracker
        </h1>
        <p className="mt-3 text-lg font-medium leading-snug text-black/90">
          Create an account or log in to sync your health data.
        </p>
      </div>

      {!supabaseConfigured && (
        <>
          <div
            className="mb-8 rounded-2xl border-4 border-amber-600 bg-amber-50 px-4 py-4 text-left text-base font-semibold text-amber-950"
            role="status"
          >
            Cloud sync is off. Set{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-sm">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-sm">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            in Vercel (or{" "}
            <code className="rounded bg-white px-1 py-0.5 font-mono text-sm">
              .env.local
            </code>
            ) and redeploy.
          </div>
          {envDebugSlot}
          <div className="mb-6 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
            <p className="mb-1 font-semibold uppercase tracking-wide text-slate-600">
              Client bundle
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
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="auth-email"
            className="block text-lg font-bold text-black"
          >
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 min-h-[52px] w-full rounded-xl border-4 border-black bg-white px-4 text-xl font-semibold text-black outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
            required
          />
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="block text-lg font-bold text-black"
          >
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 min-h-[52px] w-full rounded-xl border-4 border-black bg-white px-4 text-xl font-semibold text-black outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
            required
            minLength={mode === "signup" ? 8 : undefined}
          />
          {mode === "signup" && (
            <p className="mt-2 text-sm font-medium text-black/70">
              Use at least 8 characters.
            </p>
          )}
        </div>

        {error && (
          <p
            className="rounded-xl border-4 border-red-700 bg-red-50 px-4 py-3 text-lg font-semibold text-red-950"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !supabaseConfigured}
          className="min-h-[60px] w-full rounded-2xl border-4 border-black bg-black py-4 text-xl font-black uppercase tracking-wide text-white shadow-md transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Please wait…"
            : mode === "signup"
              ? "Sign up"
              : "Log in"}
        </button>
      </form>

      <div className="mt-8 text-center">
        {mode === "signup" ? (
          <p className="text-lg font-medium text-black">
            Already have an account?{" "}
            <button
              type="button"
              className="font-black underline decoration-2 underline-offset-2"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
            >
              Log in
            </button>
          </p>
        ) : (
          <p className="text-lg font-medium text-black">
            Need an account?{" "}
            <button
              type="button"
              className="font-black underline decoration-2 underline-offset-2"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
            >
              Sign up
            </button>
          </p>
        )}
      </div>

      <p className="mt-10 text-center text-base font-medium leading-relaxed text-black/80">
        After you continue, you&apos;ll return to the app with data tied to this
        account.
      </p>
    </main>
  );
}
