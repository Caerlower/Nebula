"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Surface container — header/title/footer helpers unused; pad content via className. */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border bg-card text-card-foreground shadow-[var(--card-shadow)] transition-colors duration-200 hover:border-border-strong",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export { Card };
