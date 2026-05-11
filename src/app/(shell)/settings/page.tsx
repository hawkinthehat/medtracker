"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEFAULT_WALK_BUTTON_LABEL,
  DEFAULT_WALK_NOTES,
  getWalkButtonLabel,
  getWalkNotesDefault,
  setWalkButtonLabel,
  setWalkNotesDefault,
} from "@/lib/movement-settings";

export default function SettingsPage() {
  const [walkLabel, setWalkLabelState] = useState(DEFAULT_WALK_BUTTON_LABEL);
  const [walkNotes, setWalkNotesState] = useState(DEFAULT_WALK_NOTES);

  useEffect(() => {
    setWalkLabelState(getWalkButtonLabel());
    setWalkNotesState(getWalkNotesDefault());
  }, []);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setWalkButtonLabel(walkLabel);
    setWalkNotesDefault(walkNotes);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600">
          Labels and defaults are stored on this device only.
        </p>
      </header>

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
