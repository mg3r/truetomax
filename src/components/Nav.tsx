"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "./Mark";
import { APP_NAME } from "@/lib/brand";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/routine", label: "Routine" },
  { href: "/schedule", label: "Schedule" },
  { href: "/vision", label: "Vision" },
  { href: "/projects", label: "Projects" },
  { href: "/journal", label: "Journal" },
  { href: "/ideas", label: "Ideas" },
  { href: "/partner", label: "Partner" },
  { href: "/profile", label: "Profile" },
];

export function Nav() {
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href) || (href === "/projects" && path.startsWith("/plan")) || (href === "/partner" && path.startsWith("/learned"));

  return (
    <>
      <header className="relative z-20 mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 pt-5 pb-2 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-serif text-lg">
          <Mark size={18} className="text-ink" />
          {APP_NAME}
        </Link>
        <Link href="/profile" className={`text-sm sm:hidden ${active("/profile") ? "text-ink" : "text-muted"}`}>
          Profile
        </Link>
        <nav className="hidden gap-0.5 sm:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-2 py-1 text-sm ${active(l.href) ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Phone: thumb-reach tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-8 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        {LINKS.filter((l) => l.href !== "/profile").map((l) => (
          <Link key={l.href} href={l.href} className={`py-3 text-center text-[0.65rem] tracking-tight ${active(l.href) ? "font-semibold text-ink" : "text-muted"}`}>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
