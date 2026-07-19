"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small procedural constellation, seeded by the heading so each empty state is distinct. */
function Constellation({ seed }: { seed: string }) {
  const stars = useMemo(() => {
    const rng = mulberry32(hashSeed(seed));
    const count = 7 + Math.floor(rng() * 3);
    return Array.from({ length: count }, () => ({
      x: 12 + rng() * 96,
      y: 12 + rng() * 96,
      r: 1.2 + rng() * 1.6,
      bright: rng() > 0.72,
    }));
  }, [seed]);

  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      aria-hidden
      className="text-muted-foreground/60"
    >
      {stars.slice(1).map((star, i) => {
        const prev = stars[i]!;
        return (
          <line
            key={`l${i}`}
            x1={prev.x}
            y1={prev.y}
            x2={star.x}
            y2={star.y}
            stroke="currentColor"
            strokeOpacity={0.28}
            strokeWidth={0.7}
          />
        );
      })}
      {stars.map((star, i) => (
        <circle
          key={`s${i}`}
          cx={star.x}
          cy={star.y}
          r={star.r}
          fill={star.bright ? "var(--primary)" : "currentColor"}
          fillOpacity={star.bright ? 0.9 : 0.55}
        />
      ))}
    </svg>
  );
}

interface EmptyStateProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ title, subtitle, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1 px-6 py-16 text-center", className)}>
      <div className="relative mb-2 flex size-28 items-center justify-center">
        <span
          aria-hidden
          className="texture-dots absolute -inset-6 [mask-image:radial-gradient(circle_at_center,black_20%,transparent_72%)] [-webkit-mask-image:radial-gradient(circle_at_center,black_20%,transparent_72%)]"
        />
        <span
          aria-hidden
          className="absolute inset-3 rounded-full border border-border bg-surface/60"
        />
        <Constellation seed={title} />
      </div>
      <h3 className="mt-2 text-lg font-medium">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
