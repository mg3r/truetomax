import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT } from "@/lib/portfolio";
import { siteBase } from "@/lib/portfolioData";

export const metadata: Metadata = {
  title: { default: "Max Gross", template: "%s · Max Gross" },
  description: "Pottery and other work by Max Gross.",
  openGraph: { title: "Max Gross", description: "Pottery and other work by Max Gross.", siteName: "truetomax" },
  robots: { index: true, follow: true },
};

/** The public site: no app chrome, just the work and a way to say hello. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const base = await siteBase();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8">
      <header className="flex items-baseline justify-between gap-4 pt-8 pb-4">
        <Link href={base || "/"} className="font-serif text-xl">Max Gross</Link>
        <a href={`mailto:${CONTACT.email}?subject=Hello`} className="text-sm text-muted hover:text-clay">Say hello</a>
      </header>
      {children}
      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line py-8 text-sm text-muted">
        <span>© {new Date().getFullYear()} Max Gross</span>
        <span className="flex gap-4">
          <a href={`mailto:${CONTACT.email}`} className="hover:text-clay">Email</a>
          <a href={`https://instagram.com/${CONTACT.instagram}`} target="_blank" rel="noopener noreferrer" className="hover:text-clay">Instagram</a>
        </span>
      </footer>
    </div>
  );
}
