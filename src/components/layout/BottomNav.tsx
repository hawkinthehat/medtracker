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
} from "lucide-react";

const links = [
  { href: "/", label: "Planner", Icon: LayoutGrid },
  { href: "/meds", label: "Meds", Icon: Pill },
  { href: "/vitals", label: "Vitals", Icon: Activity },
  { href: "/journal", label: "Journal", Icon: BookOpen },
  { href: "/vault", label: "Vault", Icon: Archive },
  { href: "/clinical", label: "Clinical", Icon: LineChart },
  { href: "/transfer", label: "Transfer", Icon: Share2 },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-700/80 bg-slate-950/95 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
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
                className={`flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[10px] font-medium leading-tight tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 sm:gap-1 sm:px-2.5 sm:py-2 sm:text-xs ${
                  active
                    ? "text-sky-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon
                  className={`h-5 w-5 sm:h-6 sm:w-6 ${active ? "text-sky-400" : ""}`}
                  strokeWidth={active ? 2.25 : 2}
                  aria-hidden
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
