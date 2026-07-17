import { cn } from "@/lib/utils";

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const SIZE_CLASS = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
} as const;

/**
 * Deterministic gradient avatar for an agent — the same name always yields the
 * same cosmic hue, so agents stay visually distinguishable across the app.
 */
export function AgentAvatar({
  name,
  seed,
  color,
  size = "md",
  className,
}: {
  name: string;
  seed?: string;
  /** Optional hue override (0–359 as string). Falls back to a hash of seed/name. */
  color?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const override = color != null && color !== "" ? Number(color) : NaN;
  const hue = Number.isFinite(override)
    ? ((override % 360) + 360) % 360
    : hashSeed(seed ?? name) % 360;
  const hue2 = (hue + 42) % 360;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-semibold text-white shadow-[var(--card-shadow)] ring-1 ring-white/10",
        SIZE_CLASS[size],
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 72% 55%), hsl(${hue2} 70% 45%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}
