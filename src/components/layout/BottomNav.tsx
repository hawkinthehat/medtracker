"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Pill,
  Activity,
  BookOpen,
  Archive,
  LineChart,
  Share2,
  FileText,
  UtensilsCrossed,
  Settings2,
} from "lucide-react";

const links = [
  { href: "/", label: "Planner", Icon: LayoutGrid },
  { href: "/meds", label: "Meds", Icon: Pill },
  { href: "/food", label: "Food", Icon: UtensilsCrossed },
  { href: "/vitals", label: "Vitals", Icon: Activity },
  { href: "/journal", label: "Journal", Icon: BookOpen },
  { href: "/vault", label: "Vault", Icon: Archive },
  { href: "/clinical", label: "Clinical", Icon: LineChart },
  { href: "/settings", label: "Settings", Icon: Settings2 },
  { href: "/doctor-report", label: "Doctor Report", Icon: FileText },
  { href: "/transfer", label: "Transfer", Icon: Share2 },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-slate-300 bg-white/95 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-4px_20px_rgba(15,23,42,0.06)]"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-5xl items-stretch justify-around px-1 sm:px-2">
        {links.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-transparent px-1 py-2 text-[11px] font-semibold leading-tight tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:px-2 sm:text-xs ${
                  active
                    ? "border-sky-200 bg-sky-50 text-sky-800"
                    : "text-slate-700 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon
                  className={`h-7 w-7 sm:h-8 sm:w-8 ${active ? "text-sky-600" : "text-slate-600"}`}
                  strokeWidth={active ? 2.25 : 2}
                  aria-hidden
                />
                <span className="max-w-[4.5rem] text-center">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
