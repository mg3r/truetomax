"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "./Mark";
import { APP_NAME } from "@/lib/brand";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/journal", label: "Journal" },
  { href: "/projects", label: "Projects" },
  { href: "/visions", label: "Visions" },
  { href: "/ideas", label: "Ideas" },
  { href: "/partner", label: "Partner" },
];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 pt-5 pb-2 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-serif text-lg">
          <Mark size={18} className="text-ink" />
          {APP_NAME}
        </Link>
        <nav className="hidden gap-1 sm:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-1 text-sm ${active(l.href) ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/settings" className={`text-sm sm:ml-2 ${active("/settings") ? "text-ink" : "text-muted hover:text-ink"}`}>
          Setup
        </Link>
      </header>

      {/* Phone: thumb-reach tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`py-3 text-center text-[0.78rem] ${active(l.href) ? "font-semibold text-ink" : "text-muted"}`}>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
