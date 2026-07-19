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

/** Fixed brand fills — flat Stellar palette blocks with legible ink. */
const BRAND_FILLS = [
  "bg-brand text-brand-foreground",
  "bg-[var(--brand-lavender)] text-[var(--brand-black)]",
  "bg-[var(--brand-teal)] text-[var(--brand-black)]",
  "bg-[var(--brand-sand)] text-[var(--brand-black)]",
] as const;

/** Resolve the brand fill class for a stored hue string — same bucketing as the avatar. */
export function brandFillForHue(hue: string): string {
  const n = Number(hue);
  const bucket = Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : 0;
  return BRAND_FILLS[bucket % BRAND_FILLS.length]!;
}

/**
 * Deterministic avatar for an agent — the same name always maps to the same
 * Stellar brand fill, so agents stay visually distinguishable across the app.
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
  const bucket = Number.isFinite(override)
    ? ((Math.round(override) % 360) + 360) % 360
    : hashSeed(seed ?? name);
  const fill = BRAND_FILLS[bucket % BRAND_FILLS.length]!;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl border border-border font-semibold shadow-[var(--card-shadow)]",
        fill,
        SIZE_CLASS[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
