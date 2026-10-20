"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "./Mark";
import { APP_NAME } from "@/lib/brand";

// The whole app, grouped by what you're doing: your day, what you're building, and reflecting and sharing.
const GROUPS = [
  {
    label: "Your day",
    links: [
      { href: "/", label: "Today" },
      { href: "/actions", label: "Actions" },
      { href: "/rituals", label: "Rituals" },
      { href: "/practices", label: "Practices" },
      { href: "/schedule", label: "Schedule" },
    ],
  },
  {
    label: "Building",
    links: [
      { href: "/vision", label: "Vision" },
      { href: "/projects", label: "Projects" },
      { href: "/ideas", label: "Ideas" },
    ],
  },
  {
    label: "Reflecting and sharing",
    links: [
      { href: "/journal", label: "Journal" },
      { href: "/socials", label: "Socials" },
      { href: "/partner", label: "Partner" },
    ],
  },
];
const PROFILE = { href: "/profile", label: "Profile" };
// The phone's bottom bar keeps the four you reach for most; the rest are one tap away under Menu.
const BAR = ["/", "/actions", "/projects", "/partner"];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href) || (href === "/projects" && path.startsWith("/plan")));
}

function Links({ onPick }: { onPick?: () => void }) {
  const active = useActive();
  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-6">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className="px-3 text-[0.7rem] tracking-wide text-muted uppercase">{g.label}</p>
            <ul className="mt-1.5 space-y-0.5">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={onPick}
                    aria-current={active(l.href) ? "page" : undefined}
                    className={`block rounded-full px-3 py-1.5 ${active(l.href) ? "bg-ink text-bg" : "text-muted hover:bg-surface hover:text-ink"}`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-6">
        <Link
          href={PROFILE.href}
          onClick={onPick}
          aria-current={active(PROFILE.href) ? "page" : undefined}
          className={`block rounded-full px-3 py-1.5 ${active(PROFILE.href) ? "bg-ink text-bg" : "text-muted hover:bg-surface hover:text-ink"}`}
        >
          {PROFILE.label}
        </Link>
      </div>
    </div>
  );
}

export function Nav() {
  const active = useActive();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const all = [...GROUPS.flatMap((g) => g.links), PROFILE];

  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const brand = (
    <Link href="/" className="flex items-center gap-2 px-3 font-serif text-lg">
      <Mark size={18} className="text-ink" />
      {APP_NAME}
    </Link>
  );

  return (
    <>
      {/* Computer and tablet: the whole app down the left side */}
      <aside aria-label="Main" className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-bg px-4 pt-6 pb-6 md:flex">
        {brand}
        <nav className="mt-8 flex flex-1 flex-col" aria-label="Main">
          <Links />
        </nav>
      </aside>

      {/* Phone: name and menu up top */}
      <header className="relative z-20 flex items-center justify-between gap-4 pt-5 pr-3 pl-1 pb-2 md:hidden">
        {brand}
        <button onClick={() => setOpen(true)} aria-expanded={open} aria-controls="menu" aria-label="Menu" className="grid h-9 w-9 place-items-center rounded-full text-muted hover:text-ink">
          <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
            <path d="M1 1h16M1 6h16M1 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div aria-hidden="true" onClick={() => setOpen(false)} className="sidebar-scrim absolute inset-0" />
          <aside id="menu" aria-label="Menu" className="sidebar-panel absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-bg px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            {brand}
            <nav className="mt-8 flex flex-1 flex-col" aria-label="Main">
              <Links onPick={() => setOpen(false)} />
            </nav>
          </aside>
        </div>
      )}

      {/* Phone: the four you reach for most, plus everything else under Menu */}
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {all
          .filter((l) => BAR.includes(l.href))
          .map((l) => (
            <Link key={l.href} href={l.href} className={`py-3 text-center text-xs ${active(l.href) ? "font-semibold text-ink" : "text-muted"}`}>
              {l.label}
            </Link>
          ))}
        <button onClick={() => setOpen(true)} className={`py-3 text-center text-xs ${all.some((l) => !BAR.includes(l.href) && active(l.href)) ? "font-semibold text-ink" : "text-muted"}`}>
          Menu
        </button>
      </nav>
    </>
  );
}
