"use client";

import { motion, useReducedMotion } from "framer-motion";

import { AnimatedNumber } from "@/components/shared/animated-number";
import { fmtInt } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  max?: number;
  size?: number;
  label?: string;
}

export function ScoreRing({ score, max = 100, size = 168, label }: ScoreRingProps) {
  const reduced = useReducedMotion();
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, score / max));

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={`Score ${score} out of ${max}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-elevated)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduced ? circumference * (1 - fraction) : circumference }}
          animate={{ strokeDashoffset: circumference * (1 - fraction) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <AnimatedNumber value={score} format={fmtInt} className="text-3xl font-medium" />
        {label ? <span className="mt-0.5 text-xs text-muted-foreground">{label}</span> : null}
      </div>
    </div>
  );
}
