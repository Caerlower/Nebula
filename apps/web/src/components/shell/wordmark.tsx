"use client";

import { cn } from "@/lib/utils";

export function Wordmark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-baseline gap-1 font-display text-[22px] leading-none", className)}
      aria-label="Nebula"
    >
      {compact ? "N" : "Nebula"}
      <span aria-hidden className="text-primary">
        •
      </span>
    </span>
  );
}
