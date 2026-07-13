"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Surface container — header/title/footer helpers unused; pad content via className. */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "card-edge rounded-2xl border bg-card/80 text-card-foreground shadow-[var(--card-shadow)] backdrop-blur-md transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_20px_52px_-18px_var(--shadow-primary)]",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export { Card };
