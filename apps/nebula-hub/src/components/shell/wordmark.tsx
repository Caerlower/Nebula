"use client";

import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-[16px] font-bold leading-none tracking-[-0.02em]",
        className,
      )}
      aria-label="Nebula"
    >
      <span aria-hidden className="block size-2.5 shrink-0 rounded-full bg-primary" />
      Nebula
    </span>
  );
}
