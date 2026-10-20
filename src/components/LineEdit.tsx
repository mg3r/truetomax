"use client";

import { useEffect, useRef } from "react";

/** Text you edit in place that wraps onto the next line instead of being cut off. Enter saves, like a single line. */
export function LineEdit({ className = "", ...props }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(fit, [props.value]);
  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <textarea
      ref={ref}
      rows={1}
      {...props}
      onInput={fit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
        props.onKeyDown?.(e);
      }}
      className={`block resize-none overflow-hidden ${className}`}
    />
  );
}
