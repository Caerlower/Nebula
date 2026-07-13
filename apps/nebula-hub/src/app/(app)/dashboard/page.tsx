"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/shared/page-header";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { Sparkline } from "@/components/shared/sparkline";
import { ScoreRing } from "@/components/shared/score-ring";
import { StatCard } from "@/components/shared/stat-card";
import { StatusDot, AGENT_STATUS_META, TxTypeLabel, TxStatusBadge } from "@/components/shared/status-badges";
import { AXIS_PROPS, GRID_PROPS, makeTooltip } from "@/components/shared/chart-bits";
import { ChartSkeleton, ListSkeleton, StatCardSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as api from "@/lib/api";
import { fmtAmount, fmtDate, fmtDateTime, fmtUSD, fmtXLM, timeAgo } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { cn } from "@/lib/utils";
import type { TimeRange } from "@/types/domain";

const RANGES: { key: TimeRange; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "all", label: "All" },
];

function BalanceChartCard() {
  const [range, setRange] = useState<TimeRange>("30d");
  const { data, loading } = useLoad(() => api.getBalanceHistory(range), [range]);

  const short = range === "24h" || range === "7d";
  const labelFmt = (label: string | number | undefined) =>
    typeof label === "string" ? (short ? fmtDateTime(label) : fmtDate(label)) : "";
  const BalanceTooltip = makeTooltip((v) => fmtAmount(v, "XLM"), labelFmt);

  return (
    <Card className="p-5 md:col-span-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">Balance over time</p>
          <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-[2px] bg-chart-2" /> Balance
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-[2px] bg-chart-3" /> Cumulative yield
            </span>
          </div>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as TimeRange)}>
          <TabsList aria-label="Time range">
            {RANGES.map((r) => (
              <TabsTrigger key={r.key} value={r.key} className="px-2.5 text-xs">
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {loading && !data ? (
        <ChartSkeleton height={264} />
      ) : data ? (
        <div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} syncId="balance">
                <defs>
                  <linearGradient id="fill-balance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="time" hide />
                <YAxis
                  {...AXIS_PROPS}
                  width={52}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`
                  }
                  domain={["auto", "auto"]}
                />
                <Tooltip content={BalanceTooltip} cursor={{ stroke: "var(--border)" }} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name="Balance"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  fill="url(#fill-balance)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 h-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} syncId="balance">
                <defs>
                  <linearGradient id="fill-yield" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  {...AXIS_PROPS}
                  tickFormatter={(v: string) => (short ? fmtDateTime(v) : fmtDate(v))}
                  minTickGap={48}
                />
                <YAxis {...AXIS_PROPS} width={52} domain={["auto", "auto"]} hide={false} tickCount={3} />
                <Tooltip content={BalanceTooltip} cursor={{ stroke: "var(--border)" }} />
                <Area
                  type="monotone"
                  dataKey="yield"
                  name="Cumulative yield"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  fill="url(#fill-yield)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function SpendVsPolicyCard() {
  const { data: wallet } = useLoad(() => api.getWallet(), []);
  const { data: policy } = useLoad(() => api.getPolicy(), []);

  if (!wallet || !policy) {
    return <StatCardSkeleton className="md:col-span-4" />;
  }

  const fraction = wallet.spendTodayUSD / policy.dailyCapUSD;
  const barClass = fraction >= 1 ? "bg-primary" : fraction >= 0.8 ? "bg-warning" : "bg-teal";

  return (
    <StatCard
      label="Spending vs policy"
      tone="teal"
      className="md:col-span-4"
      footer={
        <Link
          href="/policy"
          className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Adjust policy →
        </Link>
      }
    >
      <p className="font-mono text-2xl tabular">
        {fmtUSD(wallet.spendTodayUSD)}
        <span className="ml-1.5 text-sm text-muted-foreground">
          of {fmtUSD(policy.dailyCapUSD)} today
        </span>
      </p>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-elevated"
        role="meter"
        aria-valuenow={Math.round(fraction * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Share of daily spending limit used"
      >
        <div
          className={cn("h-full rounded-full transition-all duration-700", barClass)}
          style={{ width: `${Math.min(100, fraction * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {Math.round(fraction * 100)}% of the daily cap used
        {fraction >= 0.8 && fraction < 1 ? " — approaching the limit" : ""}
        {fraction >= 1 ? " — limit reached, payments pause" : ""}
      </p>
    </StatCard>
  );
}

const TIER_BLURB: Record<string, string> = {
  unrated: "no feedback yet",
  low: "early signal",
  medium: "building history",
  high: "strong sample",
  nascent: "no feedback yet",
  Emerging: "early signal",
  Established: "building history",
  Trusted: "strong sample",
  Elite: "top standing",
};

export default function DashboardPage() {
  const { data: wallet } = useLoad(() => api.getWallet(), []);
  const { data: agents } = useLoad(() => api.getAgents(), []);
  const { data: recentTxs } = useLoad(() => api.getRecentTransactions(5), []);
  const { data: reputation } = useLoad(() => api.getReputation(), []);
  const { data: sparkHistory } = useLoad(() => api.getBalanceHistory("30d"), []);

  const activeAgents = (agents ?? []).filter((a) => a.status === "active");
  const agentName = (id: string) => agents?.find((a) => a.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        eyebrow="overview"
        title="Dashboard"
        subtitle="Balance, activity, and safety — at a glance."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* wallet balance */}
        {wallet ? (
          <StatCard
            label="Wallet balance"
            tone="primary"
            className="md:col-span-4"
            footer={
              <Link
                href="/treasury"
                className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                View treasury →
              </Link>
            }
          >
            <div>
              <AnimatedNumber
                value={wallet.balanceXLM}
                format={fmtXLM}
                className="bg-[image:var(--gradient-primary)] bg-clip-text text-4xl font-semibold text-transparent"
              />
              <span className="ml-1.5 font-mono text-sm text-muted-foreground">XLM</span>
            </div>
            {wallet.usdPerXlm != null ? (
              <p className="mt-1 font-mono text-sm tabular text-muted-foreground">
                ≈ {fmtUSD(wallet.balanceXLM * wallet.usdPerXlm)} USDC
              </p>
            ) : null}
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-[13px]",
                wallet.change24hPct >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {wallet.change24hPct >= 0 ? (
                <ArrowUpRight className="size-3.5" aria-hidden />
              ) : (
                <ArrowDownRight className="size-3.5" aria-hidden />
              )}
              {Math.abs(wallet.change24hPct).toFixed(2)}% (24h)
            </p>
          </StatCard>
        ) : (
          <StatCardSkeleton className="md:col-span-4" />
        )}

        {/* yield earned */}
        {wallet && sparkHistory ? (
          <StatCard label="Yield earned (30d)" tone="warm" className="md:col-span-4">
            <div>
              <AnimatedNumber
                value={wallet.yield30dXLM}
                format={fmtXLM}
                className="text-3xl font-medium text-warm"
              />
              <span className="ml-1.5 font-mono text-sm text-muted-foreground">XLM</span>
            </div>
            <div className="mt-3">
              <Sparkline
                id="yield30"
                data={sparkHistory.map((p) => p.yield)}
                color="var(--chart-3)"
              />
            </div>
          </StatCard>
        ) : (
          <StatCardSkeleton className="md:col-span-4" />
        )}

        {/* active agents */}
        {agents ? (
          <StatCard
            label="Active agents"
            tone="teal"
            className="md:col-span-4"
            footer={
              <Link
                href="/agents"
                className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Manage agents →
              </Link>
            }
          >
            <p>
              <AnimatedNumber value={activeAgents.length} className="text-3xl font-medium" />
              <span className="ml-1.5 text-sm text-muted-foreground">of {agents.length}</span>
            </p>
            <ul className="mt-3 space-y-1.5">
              {agents.slice(0, 3).map((agent) => (
                <li key={agent.id} className="flex items-center gap-2 text-[13px]">
                  <StatusDot tone={AGENT_STATUS_META[agent.status].tone} />
                  <span className="truncate">{agent.name}</span>
                  <span className="ml-auto text-muted-foreground">
                    {AGENT_STATUS_META[agent.status].label}
                  </span>
                </li>
              ))}
            </ul>
          </StatCard>
        ) : (
          <StatCardSkeleton className="md:col-span-4" />
        )}

        <BalanceChartCard />
        <SpendVsPolicyCard />

        {/* recent transactions */}
        <Card className="p-5 md:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[13px] font-medium text-muted-foreground">Recent transactions</p>
            <Link
              href="/transactions"
              className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              View all →
            </Link>
          </div>
          {!recentTxs || !agents ? (
            <TableSkeleton rows={5} cols={5} />
          ) : recentTxs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentTxs.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">{timeAgo(tx.time)}</span>
                  <span className="hidden w-20 shrink-0 truncate sm:block">{agentName(tx.agentId)}</span>
                  <TxTypeLabel type={tx.type} />
                  <span className="ml-auto font-mono text-[13px] tabular">
                    {fmtAmount(tx.amount, tx.asset)}
                  </span>
                  <TxStatusBadge status={tx.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* reputation */}
        <StatCard
          label="Reputation score"
          tone="primary"
          className="items-center md:col-span-4"
          footer={
            reputation ? (
              <div className="w-full text-center">
                <Link
                  href="/reputation"
                  className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  See breakdown →
                </Link>
              </div>
            ) : null
          }
        >
          {reputation ? (
            <>
              <ScoreRing
                score={reputation.score}
                max={reputation.scoreMax}
                label={`of ${reputation.scoreMax}`}
              />
              <p className="mt-2 text-center text-sm">
                <span className="font-medium capitalize">{reputation.confidence}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — {TIER_BLURB[reputation.confidence] ?? TIER_BLURB.unrated}
                </span>
              </p>
            </>
          ) : (
            <ListSkeleton rows={3} className="mt-4 w-full" />
          )}
        </StatCard>
      </div>
    </div>
  );
}
