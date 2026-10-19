"use client";

import { useEffect, useRef } from "react";

/** A textarea that grows with its text, so it reads like a page, not a form. */
export function Grow(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(fit, [props.value]);
  return <textarea ref={ref} rows={1} {...props} onInput={fit} />;
}
