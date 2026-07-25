import { cn } from "@/lib/utils";

/** Soft-panel block used on the Settings grid (Claude Design). */
export function SettingsPanel({
  id,
  title,
  children,
  className,
  cta,
  onCta,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <section id={id} className={cn("soft-panel scroll-mt-8 px-[30px] py-7", className)}>
      <div className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
        {title}
      </div>
      <div className="mt-1">{children}</div>
      {cta ? (
        <button
          type="button"
          onClick={onCta}
          className="mt-[18px] inline-flex rounded-full border border-border px-[18px] py-2 text-[12px] text-muted-foreground hover:text-foreground"
        >
          {cta}
        </button>
      ) : null}
    </section>
  );
}

/** Label · value row inside a settings panel. */
export function SettingsRow({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-[15px] last:border-b-0">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 text-right font-mono text-[12px]">{value}</div>
        {action}
      </div>
    </div>
  );
}
