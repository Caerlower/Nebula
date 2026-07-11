"use client";

import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/shared/page-header";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { ScoreRing } from "@/components/shared/score-ring";
import { AXIS_PROPS, GRID_PROPS, makeTooltip } from "@/components/shared/chart-bits";
import { ChartSkeleton, ListSkeleton, StatCardSkeleton } from "@/components/shared/skeletons";
import { Card } from "@/components/ui/card";
import * as api from "@/lib/api";
import { fmtDate, fmtInt, timeAgo } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

const TIER_DESCRIPTION: Record<string, string> = {
  Emerging: "Newer identity — keep settling payments cleanly to climb.",
  Established: "A consistent record. Counterparties see a dependable agent.",
  Trusted: "Strong track record across payments, policy, and uptime.",
  Elite: "Top percentile — the strongest signal Stellar8004 can carry.",
};

export default function ReputationPage() {
  const { data: reputation, loading } = useLoad(() => api.getReputation(), []);

  const ScoreTooltip = makeTooltip(
    (v) => fmtInt(v),
    (label) => (typeof label === "string" ? fmtDate(label) : ""),
  );

  return (
    <div>
      <PageHeader
        eyebrow="agents"
        title="Reputation"
        subtitle="Your Stellar8004 on-chain standing — earned by behaving well, verifiable by anyone."
        actions={
          <a
            href="https://github.com/stellar/stellar-protocol/discussions"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Stellar8004 spec <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
      />

      {loading || !reputation ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton className="lg:col-span-2" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* score */}
            <Card className="flex flex-col items-center justify-center gap-4 p-6">
              <ScoreRing score={reputation.score} label="of 1000" />
              <div className="text-center">
                <p className="text-lg font-medium">{reputation.tier}</p>
                <p
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 text-[13px]",
                    reputation.deltaWeek >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {reputation.deltaWeek >= 0 ? (
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  ) : (
                    <ArrowDownRight className="size-3.5" aria-hidden />
                  )}
                  {reputation.deltaWeek >= 0 ? "+" : ""}
                  {reputation.deltaWeek} this week
                </p>
                <p className="mt-2 max-w-60 text-[13px] text-muted-foreground">
                  {TIER_DESCRIPTION[reputation.tier]}
                </p>
              </div>
            </Card>

            {/* score over time */}
            <Card className="p-5 lg:col-span-2">
              <p className="text-[13px] font-medium text-muted-foreground">Score over time (90d)</p>
              <div className="mt-4 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={reputation.history} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="fill-score" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis
                      dataKey="time"
                      {...AXIS_PROPS}
                      tickFormatter={(v: string) => fmtDate(v)}
                      minTickGap={48}
                    />
                    <YAxis {...AXIS_PROPS} width={40} domain={[0, 1000]} tickCount={5} />
                    <Tooltip content={<ScoreTooltip />} cursor={{ stroke: "var(--border)" }} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      name="Score"
                      stroke="var(--chart-4)"
                      strokeWidth={2}
                      fill="url(#fill-score)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* breakdown */}
          <div>
            <p className="mb-3 text-[13px] font-medium text-muted-foreground">Breakdown</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {reputation.components.map((component) => (
                <Card key={component.key} className="p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm">{component.label}</p>
                    <p className="font-mono text-sm tabular text-muted-foreground">
                      <AnimatedNumber value={component.score} format={fmtInt} />/{component.max}
                    </p>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-elevated">
                    <div
                      className="h-full rounded-full bg-chart-4 transition-all duration-700"
                      style={{ width: `${(component.score / component.max) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                    {component.explainer}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          {/* events */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <p className="text-[13px] font-medium text-muted-foreground">Recent events</p>
            </div>
            {reputation.events.length === 0 ? (
              <ListSkeleton rows={3} className="p-5" />
            ) : (
              <ul className="divide-y divide-border">
                {reputation.events.map((event) => (
                  <li key={event.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span
                      className={cn(
                        "w-10 shrink-0 font-mono text-[13px] tabular",
                        event.delta >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {event.delta >= 0 ? "+" : ""}
                      {event.delta}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{event.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(event.time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
