"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <p className="eyebrow">
          <span className="eyebrow-dot" aria-hidden>
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
