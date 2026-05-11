"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  loadBaselines,
  saveBaselines,
  TYPICAL_SYMPTOM_OPTIONS,
} from "@/lib/baselines-storage";

export default function ProfileSetupPage() {
  const router = useRouter();
  const [targetWaterOz, setTargetWaterOz] = useState(100);
  const [targetSodiumMg, setTargetSodiumMg] = useState(3000);
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());

  useEffect(() => {
    const p = loadBaselines();
    setTargetWaterOz(p.targetWaterOz);
    setTargetSodiumMg(p.targetSodiumMg);
    setSymptoms(new Set(p.typicalSymptoms));
  }, []);

  function toggleSymptom(label: string) {
    setSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const oz = Math.max(1, Math.round(Number(targetWaterOz)) || 1);
    const mg = Math.max(1, Math.round(Number(targetSodiumMg)) || 1);
    saveBaselines({
      targetWaterOz: oz,
      targetSodiumMg: mg,
      typicalSymptoms: Array.from(symptoms),
    });
    router.push("/");
  }

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2 border-b-2 border-slate-200 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-600">
          Onboarding
        </p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          Profile setup
        </h1>
        <p className="text-lg font-medium text-slate-700">
          Your targets power the water and sodium progress bars on the home
          screen. Symptom checkboxes are for your own reference.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-2xl border-4 border-black bg-white p-5 shadow-md sm:p-7"
      >
        <div className="space-y-3">
          <label
            htmlFor="target-water"
            className="block text-lg font-black text-slate-900"
          >
            Target daily water (oz)
          </label>
          <input
            id="target-water"
            type="number"
            min={1}
            step={1}
            value={targetWaterOz}
            onChange={(e) => setTargetWaterOz(Number(e.target.value))}
            className="min-h-[56px] w-full max-w-xs rounded-xl border-4 border-black bg-white px-4 text-xl font-bold tabular-nums text-slate-900"
            required
          />
        </div>

        <div className="space-y-3">
          <label
            htmlFor="target-salt"
            className="block text-lg font-black text-slate-900"
          >
            Target daily salt (mg)
          </label>
          <p className="text-sm font-medium text-slate-600">
            From your care team (Thermotabs and food still tally separately on
            the home card).
          </p>
          <input
            id="target-salt"
            type="number"
            min={1}
            step={100}
            value={targetSodiumMg}
            onChange={(e) => setTargetSodiumMg(Number(e.target.value))}
            className="min-h-[56px] w-full max-w-xs rounded-xl border-4 border-black bg-white px-4 text-xl font-bold tabular-nums text-slate-900"
            required
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-lg font-black text-slate-900">
            Typical symptoms
          </legend>
          <p className="text-sm font-medium text-slate-600">
            Check what you most often track — optional.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TYPICAL_SYMPTOM_OPTIONS.map((label) => (
              <label
                key={label}
                className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border-4 border-slate-300 bg-slate-50 px-4 py-3 text-base font-bold text-slate-900 has-[:checked]:border-black has-[:checked]:bg-amber-100"
              >
                <input
                  type="checkbox"
                  checked={symptoms.has(label)}
                  onChange={() => toggleSymptom(label)}
                  className="h-6 w-6 shrink-0 accent-slate-900"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="submit"
            className="min-h-[56px] rounded-2xl border-4 border-black bg-sky-600 px-8 text-xl font-black uppercase tracking-wide text-white shadow-md transition hover:bg-sky-700"
          >
            Save &amp; go home
          </button>
          <Link
            href="/"
            className="inline-flex min-h-[56px] items-center justify-center rounded-2xl border-4 border-slate-400 bg-white px-8 text-lg font-bold text-slate-900"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
