"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Soft tinted wash so day-theme cards don’t read as blank white slabs. */
  tone?: "primary" | "warm" | "teal";
}

const TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary:
    "border-primary/20 bg-[linear-gradient(165deg,color-mix(in_srgb,var(--primary)_10%,var(--card))_0%,var(--card)_55%)]",
  warm:
    "border-[color-mix(in_srgb,var(--accent-warm)_28%,var(--border))] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--accent-warm)_12%,var(--card))_0%,var(--card)_55%)]",
  teal:
    "border-[color-mix(in_srgb,var(--accent-teal)_28%,var(--border))] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--accent-teal)_12%,var(--card))_0%,var(--card)_55%)]",
};

export function StatCard({
  label,
  children,
  footer,
  className,
  tone,
}: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-2 p-5", tone && TONE_CLASS[tone], className)}>
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <div className="min-h-9">{children}</div>
      {footer ? (
        <div className="mt-auto pt-1 text-[13px] text-muted-foreground">{footer}</div>
      ) : null}
    </Card>
  );
}
