"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { JournalEntry, JournalSetting } from "@/lib/types";
import { labelJournalSetting } from "@/lib/journal-setting";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import JournalPainTracker from "@/components/journal/JournalPainTracker";

const SETTING_OPTIONS: { value: JournalSetting; hint: string }[] = [
  { value: "unspecified", hint: "Skip if unclear" },
  { value: "indoor", hint: "Home, clinic, etc." },
  { value: "outdoor", hint: "Missouri outdoor exposure" },
];

export default function JournalPage() {
  const qc = useQueryClient();
  const { data: entries = [] } = useQuery({
    queryKey: qk.journal,
    queryFn: async (): Promise<JournalEntry[]> => [],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24 * 30,
    refetchOnWindowFocus: false,
  });

  const [text, setText] = useState("");
  const [setting, setSetting] = useState<JournalSetting>("unspecified");

  const addEntry = useMutation({
    mutationFn: async (e: JournalEntry) => e,
    onSuccess: (row) => {
      qc.setQueryData<JournalEntry[]>(qk.journal, (prev = []) => [
        row,
        ...prev,
      ]);
      setText("");
      setSetting("unspecified");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    addEntry.mutate({
      id: crypto.randomUUID(),
      recordedAt: new Date().toISOString(),
      text: t,
      setting,
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
              Symptom journal
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Short entries sync to your phone first — helpful when signal is
              weak. Mark <span className="text-slate-300">indoor vs outdoor</span>{" "}
              when flares might tie to Missouri outdoor exposure vs food.
            </p>
          </div>
          <Link
            href="/daily"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 hover:border-sky-500/40 hover:text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <CalendarDays className="h-4 w-4 text-sky-400" aria-hidden />
            Daily summary
          </Link>
        </div>
      </header>

      <JournalPainTracker />

      <form
        onSubmit={submit}
        className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 ring-1 ring-white/5"
      >
        <fieldset>
          <legend className="text-sm font-medium text-slate-300">
            Where were you when symptoms were strongest?
          </legend>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {SETTING_OPTIONS.map(({ value, hint }) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  setting === value
                    ? "border-sky-500/60 bg-sky-950/40 text-slate-50"
                    : "border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="journal-setting"
                  value={value}
                  checked={setting === value}
                  onChange={() => setSetting(value)}
                  className="h-4 w-4 border-slate-500 text-sky-600 focus:ring-sky-500"
                />
                <span>
                  {labelJournalSetting(value)}
                  <span className="block text-xs font-normal text-slate-500">
                    {hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor="journal-text" className="sr-only">
          New entry
        </label>
        <textarea
          id="journal-text"
          rows={5}
          className="w-full resize-y rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-base text-slate-50 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="How are you feeling today? Triggers, sleep, pain, cognition…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500"
          disabled={!text.trim()}
        >
          Save entry
        </button>
      </form>

      <section aria-labelledby="journal-history">
        <h2
          id="journal-history"
          className="text-sm font-semibold uppercase tracking-wider text-slate-500"
        >
          History
        </h2>
        <ul className="mt-3 space-y-3">
          {entries.length === 0 && (
            <li className="text-sm text-slate-500">No entries yet.</li>
          )}
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <time
                  className="text-xs font-medium uppercase tracking-wide text-slate-500"
                  dateTime={entry.recordedAt}
                >
                  {new Date(entry.recordedAt).toLocaleString()}
                </time>
                <span className="rounded-full bg-slate-800/90 px-2 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-slate-600/50">
                  {labelJournalSetting(entry.setting)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                {entry.text}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
