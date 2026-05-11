"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import {
  DEFAULT_WALK_BUTTON_LABEL,
  DEFAULT_WALK_NOTES,
  getWalkButtonLabel,
  getWalkNotesDefault,
  setWalkButtonLabel,
  setWalkNotesDefault,
} from "@/lib/movement-settings";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  SYMPTOM_MATRIX_CATEGORY_LABEL,
  SYMPTOM_MATRIX_PILLAR_IDS,
  type SymptomMatrixPillarId,
} from "@/lib/symptom-matrix-data";
import {
  loadPinnedSymptomCategories,
  savePinnedSymptomCategories,
} from "@/lib/symptom-matrix-settings";

export default function SettingsPage() {
  const router = useRouter();
  const [walkLabel, setWalkLabelState] = useState(DEFAULT_WALK_BUTTON_LABEL);
  const [walkNotes, setWalkNotesState] = useState(DEFAULT_WALK_NOTES);

  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountResolved, setAccountResolved] = useState(false);

  const [pinnedSymptomCats, setPinnedSymptomCats] = useState<
    SymptomMatrixPillarId[]
  >(() =>
    typeof window !== "undefined"
      ? loadPinnedSymptomCategories()
      : [...SYMPTOM_MATRIX_PILLAR_IDS],
  );

  function toggleSymptomCategoryPin(id: SymptomMatrixPillarId) {
    setPinnedSymptomCats((prev) => {
      const has = prev.includes(id);
      if (has && prev.length <= 1) return prev;
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      savePinnedSymptomCategories(next);
      return next;
    });
  }

  useEffect(() => {
    setPinnedSymptomCats(loadPinnedSymptomCategories());
    setWalkLabelState(getWalkButtonLabel());
    setWalkNotesState(getWalkNotesDefault());
  }, []);

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    if (!sb) {
      setAccountEmail(null);
      setAccountResolved(true);
      return;
    }

    void sb.auth.getSession().then(({ data: { session } }) => {
      setAccountEmail(session?.user?.email ?? null);
      setAccountResolved(true);
    });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      setAccountEmail(session?.user?.email ?? null);
      setAccountResolved(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const sb = getSupabaseBrowserClient();
    await sb?.auth.signOut();
    setAccountEmail(null);
    router.refresh();
    router.push("/auth");
  }

  function save(e: FormEvent) {
    e.preventDefault();
    setWalkButtonLabel(walkLabel);
    setWalkNotesDefault(walkNotes);
  }

  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600">
          Labels and defaults below are stored on this device only — unless noted.
        </p>
      </header>

      {supabaseConfigured && (
        <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-900">Account</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cloud data syncs when you&apos;re signed in.
          </p>
          {!accountResolved ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : accountEmail ? (
            <div className="mt-4 space-y-3">
              <p className="break-all font-mono text-base font-semibold text-slate-900">
                {accountEmail}
              </p>
              <p className="text-xs font-medium text-emerald-800">
                Signed in — hydration and logs save under this account.
              </p>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/auth?next=/settings"
              className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl border-2 border-black bg-black px-5 text-base font-black text-white hover:bg-neutral-900"
            >
              Sign in
            </Link>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-900">Symptom matrix</h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose which disorder categories appear as large toggles on the home
          screen. At least one stays on so quick-taps stay available.
        </p>
        <ul className="mt-4 space-y-3">
          {SYMPTOM_MATRIX_PILLAR_IDS.map((id) => (
            <li key={id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-sky-700"
                  checked={pinnedSymptomCats.includes(id)}
                  onChange={() => toggleSymptomCategoryPin(id)}
                />
                <span className="text-base font-semibold text-slate-900">
                  {SYMPTOM_MATRIX_CATEGORY_LABEL[id]}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-900">Daily goals</h2>
        <p className="mt-1 text-sm text-slate-600">
          Water, salt targets, and typical symptoms live in profile setup.
        </p>
        <Link
          href="/profile-setup"
          className="mt-4 inline-flex rounded-xl border border-sky-600 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-900 hover:bg-sky-100"
        >
          Open profile setup
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-900">Barometer</h2>
        <p className="mt-1 text-sm text-slate-600">
          Grant location on the planner so pressure advisories use your current
          area.
        </p>
        <Link
          href="/#tiaki-barometer"
          className="mt-4 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Go to barometer on home
        </Link>
      </section>

      <form
        onSubmit={save}
        className="space-y-4 rounded-2xl border border-slate-300 bg-white/98 p-4 ring-1 ring-slate-200/60"
      >
        <h2 className="text-lg font-semibold text-slate-900">Movement log</h2>
        <p className="text-sm text-slate-600">
          Default label for the primary walk-style button on the planner (e.g.
          &quot;Walk Dogs&quot;).
        </p>
        <div>
          <label
            htmlFor="walk-label"
            className="text-sm font-semibold text-slate-900"
          >
            Button label
          </label>
          <input
            id="walk-label"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-base text-slate-900"
            value={walkLabel}
            onChange={(e) => setWalkLabelState(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label
            htmlFor="walk-notes"
            className="text-sm font-semibold text-slate-900"
          >
            Default notes line
          </label>
          <input
            id="walk-notes"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-gray-50 px-3 py-3 text-base text-slate-900"
            value={walkNotes}
            onChange={(e) => setWalkNotesState(e.target.value)}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl border border-sky-600 bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Save movement labels
        </button>
      </form>
    </div>
  );
}
