"use client";

import { useEffect, type RefObject } from "react";

/**
 * Close something when you tap or click anywhere outside it, or press Escape. Changes already save as you make them,
 * so there's no Done to press. The close waits a beat so a field you were typing in saves on blur first.
 */
export function useClickAway(ref: RefObject<HTMLElement | null>, active: boolean, onAway: () => void) {
  useEffect(() => {
    if (!active) return;
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setTimeout(onAway, 0);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAway();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [ref, active, onAway]);
}
