"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, children, footer, className }: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-2 p-5", className)}>
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <div className="min-h-9">{children}</div>
      {footer ? <div className="mt-auto pt-1 text-[13px] text-muted-foreground">{footer}</div> : null}
    </Card>
  );
}
