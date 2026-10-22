"use client";

import { useState, useTransition } from "react";
import { saveSiteText } from "@/app/actions";
import { Grow } from "./Grow";

/** One line of the site's text, edited in place: click, type, and it saves when you click away. Empty puts the default back. */
function Field({ k, label, value, fallback, big = false }: { k: string; label: string; value: string; fallback: string; big?: boolean }) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(value);
  const [, start] = useTransition();
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <Grow
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text.trim() === saved.trim()) return;
          const next = text.trim() || fallback;
          setText(next);
          setSaved(next);
          start(() => saveSiteText(k, text.trim() ? text : ""));
        }}
        placeholder={fallback}
        aria-label={label}
        className={`mt-0.5 block w-full resize-none rounded-xl border border-transparent bg-transparent px-2 py-1 -mx-2 hover:border-line focus:border-line focus:bg-surface focus:outline-none ${big ? "font-serif text-2xl leading-snug" : "text-sm text-muted focus:text-ink"}`}
      />
    </label>
  );
}

export function SectionText({ section, text, defaults }: { section: string; text: Record<string, string>; defaults: Record<string, string> }) {
  return (
    <div className="space-y-2">
      <Field key={`${section}_title`} k={`${section}_title`} label="Page title" value={text[`${section}_title`]} fallback={defaults[`${section}_title`]} big />
      <Field key={`${section}_blurb`} k={`${section}_blurb`} label="Page description (also shown on the home page)" value={text[`${section}_blurb`]} fallback={defaults[`${section}_blurb`]} />
    </div>
  );
}

export function HomeText({ text, defaults }: { text: Record<string, string>; defaults: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <Field k="home_title" label="Home page title" value={text.home_title} fallback={defaults.home_title} big />
      <Field k="home_intro" label="Home page intro" value={text.home_intro} fallback={defaults.home_intro} />
      <Field k="contact_title" label="Contact heading (under the photos)" value={text.contact_title} fallback={defaults.contact_title} big />
      <Field k="contact_body" label="Contact text" value={text.contact_body} fallback={defaults.contact_body} />
    </div>
  );
}
