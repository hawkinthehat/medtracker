"use client";

import Link from "next/link";
import { Dog, Dumbbell, Droplets, Pill } from "lucide-react";

const tileClass =
  "flex min-h-[60px] scroll-mt-28 flex-col items-center justify-center gap-1 rounded-2xl border-4 border-black bg-white px-3 py-3 text-center text-base font-black uppercase tracking-wide text-slate-950 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:ring-4 focus-visible:ring-sky-500";

/**
 * Primary daily shortcuts — 2×2 grid directly under the weather / dashboard strip.
 */
export default function HomeDailyActionGrid() {
  return (
    <nav
      aria-label="Daily actions"
      className="grid grid-cols-2 gap-3 pb-6"
    >
      <a href="#home-hydration" className={tileClass}>
        <Droplets className="h-8 w-8 shrink-0 text-sky-700" aria-hidden />
        Water
      </a>
      <a href="#home-movement-walk" className={tileClass}>
        <Dog className="h-8 w-8 shrink-0 text-slate-900" aria-hidden />
        Dog walk
      </a>
      <a href="#home-pt" className={tileClass}>
        <Dumbbell className="h-8 w-8 shrink-0 text-slate-900" aria-hidden />
        PT
      </a>
      <Link href="/meds" className={tileClass}>
        <Pill className="h-8 w-8 shrink-0 text-violet-700" aria-hidden />
        Meds
      </Link>
    </nav>
  );
}
