"use client";

import { useCountUp } from "@/hooks/use-count-up";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  format?: (value: number) => string;
  className?: string;
  durationS?: number;
}

export function AnimatedNumber({
  value,
  format = (v) => v.toFixed(0),
  className,
  durationS,
}: AnimatedNumberProps) {
  const animated = useCountUp(value, durationS);
  return <span className={cn("tabular font-mono", className)}>{format(animated)}</span>;
}
