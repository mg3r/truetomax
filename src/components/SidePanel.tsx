"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** A panel that slides in from the right over the page, like Notion's side peek. Esc or tapping outside closes it. */
export function SidePanel({ closeHref, openHref, label, children, actions }: { closeHref: string; openHref?: string; label: string; children: React.ReactNode; actions?: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);

  return (
    <div className="fixed inset-0 z-40">
      <Link href={closeHref} scroll={false} aria-label="Close" className="sidebar-scrim absolute inset-0 block" />
      <aside
        aria-label={label}
        className="panel-right absolute inset-y-0 right-0 flex w-full max-w-[44rem] flex-col border-l border-line bg-bg shadow-[-8px_0_32px_-16px_rgb(0_0_0/0.3)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 sm:px-8">
          <Link href={closeHref} scroll={false} className="text-sm text-muted hover:text-ink">
            Close
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {actions}
            {openHref && (
              <Link href={openHref} className="text-muted hover:text-ink">
                Open as page
              </Link>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24 sm:px-8">{children}</div>
      </aside>
    </div>
  );
}
