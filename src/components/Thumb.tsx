"use client";

import { useState } from "react";

/** A post's picture, or a quiet blank if Instagram's link has expired. */
export function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <div aria-hidden="true" className="h-full w-full bg-line/60" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />;
}
