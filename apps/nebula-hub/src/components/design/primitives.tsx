import { cn } from "@/lib/utils";

/** Giant watermark title behind page heroes (Claude Design echo). */
export function PageEcho({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute right-[-8px] bottom-0.5 select-none whitespace-nowrap text-[clamp(72px,12vw,132px)] font-semibold leading-[0.9] tracking-[-0.03em] text-foreground opacity-[0.05]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Mono eyebrow with leading hairline. */
export function SectionRule({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3.5 flex items-center gap-2.5", className)}>
      <span aria-hidden className="h-px w-[22px] shrink-0 bg-subtle" />
      <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
        {children}
      </span>
    </div>
  );
}

/** Liquid (sand) / yield (accent) / optional committed split bar. */
export function SplitBar({
  liquidPct,
  yieldPct,
  reservedPct = 0,
  className,
  height = 3,
}: {
  liquidPct: number;
  yieldPct: number;
  reservedPct?: number;
  className?: string;
  height?: number;
}) {
  const liquid = Math.max(0, Math.min(100, liquidPct));
  const yld = Math.max(0, Math.min(100 - liquid, yieldPct));
  const reserved = Math.max(0, Math.min(100 - liquid - yld, reservedPct));

  return (
    <span
      className={cn("flex w-full overflow-hidden bg-border", className)}
      style={{ height }}
      aria-hidden
    >
      {liquid > 0 ? (
        <span className="h-full bg-warm transition-[width] duration-700" style={{ width: `${liquid}%` }} />
      ) : null}
      {yld > 0 ? (
        <span className="h-full bg-primary transition-[width] duration-700" style={{ width: `${yld}%` }} />
      ) : null}
      {reserved > 0 ? (
        <span
          className="h-full border-l border-border-strong bg-[var(--panel-3)] transition-[width] duration-700"
          style={{ width: `${reserved}%` }}
        />
      ) : null}
    </span>
  );
}

/** Tall exposure-style band used on Overview (Claude Design: 52px split). */
export function ExposureBar({
  liquidPct,
  yieldPct,
  reservedPct = 0,
  className,
  spentMarkerPct,
}: {
  liquidPct: number;
  yieldPct: number;
  reservedPct?: number;
  className?: string;
  /** Optional lav marker for daily spend position (0–100). */
  spentMarkerPct?: number;
}) {
  const liquid = Math.max(0, Math.min(100, liquidPct));
  const yld = Math.max(0, Math.min(100 - liquid, yieldPct));
  const reserved = Math.max(0, Math.min(100 - liquid - yld, reservedPct));
  const marker =
    spentMarkerPct != null
      ? Math.max(0, Math.min(100, spentMarkerPct))
      : null;

  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-xl border border-border bg-elevated",
        className,
      )}
      style={{ height: 52, minHeight: 52, maxHeight: 52 }}
      role="img"
      aria-label={`Liquid ${Math.round(liquid)}%, yield ${Math.round(yld)}%, committed ${Math.round(reserved)}%`}
    >
      {liquid > 0 ? (
        <div
          className="h-full shrink-0 bg-warm transition-[width] duration-700"
          style={{ width: `${liquid}%` }}
        />
      ) : null}
      {yld > 0 ? (
        <div
          className="h-full shrink-0 bg-primary transition-[width] duration-700"
          style={{ width: `${yld}%` }}
        />
      ) : null}
      {reserved > 0 ? (
        <div
          className="h-full shrink-0 border-l border-border-strong bg-[var(--panel-3)] transition-[width] duration-700"
          style={{ width: `${reserved}%` }}
        />
      ) : null}
      {marker != null ? (
        <div
          aria-hidden
          className="pointer-events-none absolute w-0.5 bg-primary-2 shadow-[0_0_14px_2px_var(--ambient-a)] transition-[left] duration-700"
          style={{ top: -9, bottom: -9, left: `${marker}%` }}
        />
      ) : null}
    </div>
  );
}

/** Derive liquid/yield/reserved percentages from wallet amounts. */
export function splitPcts(liquid: number, blend: number, reserved = 0) {
  const total = liquid + blend + reserved;
  if (total <= 0) return { liquidPct: 0, yieldPct: 0, reservedPct: 0 };
  return {
    liquidPct: (liquid / total) * 100,
    yieldPct: (blend / total) * 100,
    reservedPct: (reserved / total) * 100,
  };
}
