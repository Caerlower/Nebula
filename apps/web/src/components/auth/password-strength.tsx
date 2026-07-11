"use client";

import { cn } from "@/lib/utils";

export type Strength = 0 | 1 | 2 | 3 | 4;

export function scorePassword(password: string): Strength {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, Math.max(1, score)) as Strength;
}

const LABELS: Record<Strength, string> = {
  0: "",
  1: "Weak",
  2: "Fair",
  3: "Good",
  4: "Strong",
};

const SEGMENT_CLASSES: Record<Strength, string> = {
  0: "",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-teal",
  4: "bg-success",
};

export function PasswordStrength({ password }: { password: string }) {
  const strength = scorePassword(password);
  return (
    <div aria-live="polite">
      <div className="flex gap-1.5" role="presentation">
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-1 flex-1 rounded-full bg-elevated transition-colors",
              strength >= segment && SEGMENT_CLASSES[strength],
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 h-4 text-xs text-muted-foreground">
        {password ? `Password strength: ${LABELS[strength]}` : ""}
      </p>
    </div>
  );
}
