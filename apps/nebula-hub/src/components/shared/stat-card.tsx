"use client";

import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Accent hue for the icon chip — the card surface itself stays flat. */
  tone?: "primary" | "warm" | "teal";
  /** Optional glyph rendered top-right in the accent hue. */
  icon?: LucideIcon;
}

const ICON_TONE: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "text-primary",
  warm: "text-warm",
  teal: "text-teal",
};

export function StatCard({
  label,
  children,
  footer,
  className,
  tone,
  icon: Icon,
}: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-3 p-6", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="stat-label">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg border border-border bg-elevated/50",
              tone ? ICON_TONE[tone] : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="min-h-9">{children}</div>
      {footer ? (
        <div className="mt-auto pt-1 text-[13px] text-muted-foreground">{footer}</div>
      ) : null}
    </Card>
  );
}
