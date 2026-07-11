"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

/** Animates from 0 (or the previous value) to `target` on mount/change. */
export function useCountUp(target: number, durationS = 0.9): number {
  const [value, setValue] = useState(0);
  const previous = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      previous.current = target;
      setValue(target);
      return;
    }
    const controls = animate(previous.current, target, {
      duration: durationS,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setValue(latest),
      onComplete: () => {
        previous.current = target;
      },
    });
    return () => controls.stop();
  }, [target, durationS, reduced]);

  return value;
}
