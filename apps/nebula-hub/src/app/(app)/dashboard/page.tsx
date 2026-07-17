"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  Loader2,
  Plug,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/shared/page-header";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { ScoreRing } from "@/components/shared/score-ring";
import { StatCard } from "@/components/shared/stat-card";
import {
  AgentStatusBadge,
  FrameworkLabel,
  TxTypeLabel,
  TxStatusBadge,
} from "@/components/shared/status-badges";
import { AgentAvatar } from "@/components/agent-scope/agent-avatar";
import { CopyButton } from "@/components/shared/copy-button";
import { AXIS_PROPS, GRID_PROPS, makeTooltip } from "@/components/shared/chart-bits";
import { ChartSkeleton, ListSkeleton, StatCardSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as api from "@/lib/api";
import { fmtAmount, fmtDate, fmtDateTime, fmtUSD, fmtXLM, timeAgo, truncMiddle } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { cn } from "@/lib/utils";
import type { TimeRange } from "@/types/domain";

const RANGES: { key: TimeRange; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "all", label: "All" },
];

function BalanceChartCard({ className }: { className?: string }) {
  const [range, setRange] = useState<TimeRange>("30d");
  const { selectedAgentId } = useAgentScope();
  const { data, loading } = useLoad(
    () => api.getBalanceHistory(range),
    [range, selectedAgentId],
  );

  const short = range === "24h" || range === "7d";
  const labelFmt = (label: string | number | undefined) =>
    typeof label === "string" ? (short ? fmtDateTime(label) : fmtDate(label)) : "";
  const BalanceTooltip = makeTooltip((v) => fmtAmount(v, "XLM"), labelFmt);

  return (
    <Card className={cn("p-5", className)}>
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
        <div className="rise-in">
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

function SpendVsPolicyCard({ className }: { className?: string }) {
  const { selectedAgentId } = useAgentScope();
  const { data: wallet } = useLoad(() => api.getWallet(), [selectedAgentId]);
  const { data: policy } = useLoad(() => api.getPolicy(), [selectedAgentId]);

  if (!wallet || !policy) {
    return <StatCardSkeleton className={className} />;
  }

  const fraction = wallet.spendTodayUSD / policy.dailyCapUSD;
  const barClass = fraction >= 1 ? "bg-primary" : fraction >= 0.8 ? "bg-warning" : "bg-teal";

  return (
    <StatCard
      label="Spending vs policy"
      tone="teal"
      className={className}
      footer={
        <Link
          href="/policy"
          className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Adjust policy →
        </Link>
      }
    >
      <p className="flex items-baseline gap-1.5">
        <span className="hero-number-sm tabular">{fmtUSD(wallet.spendTodayUSD)}</span>
        <span className="text-sm text-muted-foreground">
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

const fmtUsdcAmount = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Compact USDC-trustline control shown near the balance. Shows the "open"
 * nudge until the agent's wallet can hold USDC; with `showReady`, it swaps to a
 * success chip once the trustline exists so the user gets clear confirmation. */
function UsdcTrustlineInline({
  agentId,
  showReady = false,
}: {
  agentId: string | null;
  showReady?: boolean;
}) {
  const { data, loading, setData } = useLoad(
    () => api.getUsdcTrustlineStatus(),
    [agentId],
  );
  const [busy, setBusy] = useState(false);

  if (!agentId || (loading && !data)) return null;

  if (data?.ready) {
    if (!showReady) return null;
    return (
      <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3.5 py-2.5 text-[13px] font-medium text-success">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        USDC trustline open — this wallet is ready to receive USDC.
      </div>
    );
  }

  const open = async () => {
    setBusy(true);
    try {
      const res = await api.ensureUsdcTrustline();
      setData({ ready: true, faucet: res.faucet, issuer: data?.issuer ?? "" });
      toast.success(res.message, {
        description: res.txHash ? `tx ${res.txHash.slice(0, 8)}…` : undefined,
        action: res.faucet
          ? {
              label: "Faucet",
              onClick: () => window.open(res.faucet!, "_blank", "noreferrer"),
            }
          : undefined,
      });
    } catch (error) {
      toast.error("Couldn't open USDC trustline", {
        description: error instanceof Error ? error.message : undefined,
        action: { label: "Retry", onClick: () => void open() },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-elevated/50 px-3.5 py-3">
      <Coins className="size-4 shrink-0 text-teal" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">Open a USDC trustline</p>
        <p className="text-xs text-muted-foreground">
          One-time — required before this agent can hold or spend USDC.
        </p>
      </div>
      <Button size="sm" onClick={() => void open()} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Opening…
          </>
        ) : (
          "Open trustline"
        )}
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const { selectedAgentId, selectedAgent } = useAgentScope();
  const { data: wallet } = useLoad(() => api.getWallet(), [selectedAgentId]);
  const { data: recentTxs } = useLoad(
    () => api.getRecentTransactions(5),
    [selectedAgentId],
  );
  const { data: reputation } = useLoad(
    () => api.getReputation(),
    [selectedAgentId],
  );
  const usdc = wallet?.usdcBalance ?? 0;
  const unfunded = wallet != null && wallet.balanceXLM <= 0 && usdc <= 0;
  const up = (wallet?.change24hPct ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="overview"
        title="Dashboard"
        subtitle="Balance, activity, and safety — at a glance."
      />

      {/* 1 · agent identity */}
      {selectedAgent ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-4 shadow-[var(--card-shadow)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 160% at 0% 0%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 52%)",
            }}
          />
          <div className="relative flex flex-wrap items-center gap-4">
            <AgentAvatar
              name={selectedAgent.name}
              seed={selectedAgent.id}
              color={selectedAgent.avatarColor}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-semibold tracking-tight">
                  {selectedAgent.name}
                </p>
                <AgentStatusBadge status={selectedAgent.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <FrameworkLabel framework={selectedAgent.framework} />
                </span>
                {selectedAgent.address !== "—" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-elevated/50 px-2 py-0.5 font-mono">
                    {truncMiddle(selectedAgent.address, 4, 4)}
                    <CopyButton
                      value={selectedAgent.address}
                      label="Copy agent address"
                    />
                  </span>
                ) : (
                  <span className="rounded-md border border-border bg-elevated/50 px-2 py-0.5">
                    wallet provisioning…
                  </span>
                )}
              </div>
            </div>
            <Link
              href="/connect"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-elevated/50 px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-elevated"
            >
              <Plug className="size-3.5" aria-hidden />
              Connect &amp; keys
            </Link>
          </div>
        </div>
      ) : null}

      {/* 2 · balance + policy — compact top row */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
        {wallet ? (
          <Card className="relative overflow-hidden p-6 lg:col-span-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(115% 115% at 0% 0%, color-mix(in srgb, var(--primary) 20%, transparent), transparent 58%), radial-gradient(120% 120% at 100% 100%, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 55%)",
              }}
            />
            {unfunded ? (
              <div className="relative flex h-full flex-col">
                <p className="stat-label inline-flex items-center gap-1.5">
                  <Coins className="size-3.5" aria-hidden />
                  USDC balance
                </p>
                <p className="mt-2 hero-number-lg hero-gradient">0.00 USDC</p>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  This agent pays for everything in USDC — fund its wallet with USDC,
                  plus a little XLM for network fees.
                </p>
                {wallet.address !== "—" ? (
                  <div className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-elevated/60 px-3 py-2 font-mono text-sm">
                    {truncMiddle(wallet.address, 6, 6)}
                    <CopyButton value={wallet.address} label="Copy agent wallet address" />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Wallet provisioning…
                  </p>
                )}
                <UsdcTrustlineInline agentId={selectedAgentId} showReady />
              </div>
            ) : (
              <div className="relative">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="stat-label inline-flex items-center gap-1.5">
                      <Coins className="size-3.5" aria-hidden />
                      USDC balance
                    </p>
                    <div className="mt-2.5 flex items-end gap-2">
                      <AnimatedNumber
                        value={usdc}
                        format={fmtUsdcAmount}
                        className="hero-number-lg hero-gradient"
                      />
                      <span className="mb-1.5 font-mono text-base text-muted-foreground">
                        USDC
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Wallet className="size-3.5" aria-hidden />
                        <span className="font-mono tabular">
                          {fmtXLM(wallet.balanceXLM)} XLM
                        </span>
                        {wallet.usdPerXlm != null ? (
                          <span className="text-subtle">
                            (≈ {fmtUSD(wallet.balanceXLM * wallet.usdPerXlm)})
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "delta-pill",
                          wallet.change24hPct > 0
                            ? "delta-up"
                            : wallet.change24hPct < 0
                              ? "delta-down"
                              : "delta-flat",
                        )}
                      >
                        {up ? (
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowDownRight className="size-3.5" aria-hidden />
                        )}
                        {Math.abs(wallet.change24hPct).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/treasury"
                    className="hidden text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:block"
                  >
                    View treasury →
                  </Link>
                </div>
                <UsdcTrustlineInline agentId={selectedAgentId} />
              </div>
            )}
          </Card>
        ) : (
          <StatCardSkeleton className="lg:col-span-8" />
        )}

        <SpendVsPolicyCard className="lg:col-span-4" />
      </div>

      {/* 3 · balance over time (interactive) + standing */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
        <BalanceChartCard className="lg:col-span-8" />

        {/* standing stack — yield + reputation fill the column */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {wallet ? (
            <StatCard label="Yield earned (30d)" tone="warm" icon={TrendingUp}>
              <div className="flex items-end gap-1.5">
                <AnimatedNumber
                  value={wallet.yield30dXLM}
                  format={fmtXLM}
                  className="hero-number-sm text-warm"
                />
                <span className="mb-0.5 font-mono text-sm text-muted-foreground">
                  XLM
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Idle balance can earn yield in Treasury.
              </p>
            </StatCard>
          ) : (
            <StatCardSkeleton />
          )}

          <StatCard
            label="Reputation score"
            tone="primary"
            className="flex-1 items-center"
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
                  <span className="font-medium capitalize">
                    {reputation.confidence}
                  </span>
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

      {/* 4 · recent transactions — full width */}
      <Card className="flex flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted-foreground">
            Recent transactions
          </p>
          <Link
            href="/transactions"
            className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            View all →
          </Link>
        </div>
        {!recentTxs ? (
          <TableSkeleton rows={5} cols={4} />
        ) : recentTxs.length === 0 ? (
          <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
            No transactions yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recentTxs.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">
                  {timeAgo(tx.time)}
                </span>
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
    </div>
  );
}
