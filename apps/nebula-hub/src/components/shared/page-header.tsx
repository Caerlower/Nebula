"use client";

import { cn } from "@/lib/utils";

const ACCENTS = {
  primary: "var(--primary)",
  teal: "var(--accent-teal)",
  gold: "var(--accent-warm)",
} as const;

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  /** section signature color — Treasury teal, Reputation gold, default violet */
  accent?: keyof typeof ACCENTS;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
  accent = "primary",
}: PageHeaderProps) {
  const accentColor = ACCENTS[accent];
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <p
          className="eyebrow rounded-full border px-3 py-1"
          style={{
            borderColor: `color-mix(in srgb, ${accentColor} 28%, transparent)`,
            background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
          }}
        >
          <span
            className="eyebrow-dot"
            style={{ color: accentColor, textShadow: `0 0 12px ${accentColor}` }}
            aria-hidden
          >
            •
          </span>
          {eyebrow}
        </p>
        <h1 className="page-title mt-3">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
