"use client";

import { usePathname } from "next/navigation";

// The pages with a lot to lay out (boards, posts, long lists) get the wide column; the rest stay a reading width.
const WIDE = ["/projects", "/socials", "/vision"];

export function PageWidth({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const wide = WIDE.some((p) => path === p || path.startsWith(`${p}/`));
  return <main className={`mx-auto px-4 pt-4 pb-28 sm:px-6 md:px-10 md:pt-10 md:pb-16 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>{children}</main>;
}
