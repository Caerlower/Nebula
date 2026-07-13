"use client";

import type { TooltipContentProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

/**
 * Shared Recharts pieces — one visual system for every chart:
 * recessive grid, muted axes, elevated tooltip with mono numbers.
 */

export const AXIS_PROPS = {
  stroke: "var(--subtle-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const GRID_PROPS = {
  stroke: "var(--border)",
  vertical: false,
} as const;

interface TooltipRow {
  name: string;
  value: string;
  color?: string;
}

function ChartTooltipCard({
  label,
  rows,
}: {
  label: string;
  rows: TooltipRow[];
}) {
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {rows.map((row) => (
        <div key={row.name} className="flex items-center gap-2 text-[13px]">
          {row.color ? (
            <span
              aria-hidden
              className="inline-block size-2 rounded-[2px]"
              style={{ background: row.color }}
            />
          ) : null}
          <span className="text-muted-foreground">{row.name}</span>
          <span className="ml-auto pl-4 font-mono tabular">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function makeTooltip(
  formatValue: (value: number, seriesKey: string) => string,
  formatLabel: (label: string | number | undefined) => string,
) {
  return function NebulaTooltip({
    active,
    payload,
    label,
  }: TooltipContentProps<ValueType, NameType>) {
    if (!active || !payload?.length) return null;
    return (
      <ChartTooltipCard
        label={formatLabel(label)}
        rows={payload.map((entry) => ({
          name: String(entry.name ?? entry.dataKey ?? ""),
          value: formatValue(
            Number(entry.value ?? 0),
            String(entry.dataKey ?? ""),
          ),
          color: typeof entry.color === "string" ? entry.color : undefined,
        }))}
      />
    );
  };
}
