"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2,
  Coins,
  Loader2,
} from "lucide-react";

import { useAgentScope } from "@/components/agent-scope/agent-scope";
import {
  ExposureBar,
  PageEcho,
  SectionRule,
  splitPcts,
} from "@/components/design/primitives";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CopyButton } from "@/components/shared/copy-button";
import { ChartSkeleton, ListSkeleton } from "@/components/shared/skeletons";
import { agentAttribution } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { useLoad } from "@/hooks/use-load";
import * as api from "@/lib/api";
import { cn, fmtAmount, fmtUsdc, timeAgo, truncMiddle } from "@/lib/utils";

function sparkPath(
  points: { balance: number }[],
  w = 300,
  h = 96,
): { line: string; area: string } {
  if (points.length === 0) {
    const mid = h * 0.55;
    return {
      line: `0,${mid} ${w},${mid}`,
      area: `0,${h} 0,${mid} ${w},${mid} ${w},${h}`,
    };
  }
  const values = points.map((p) => p.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? w / 2 : (i / (points.length - 1)) * w;
    const y = h - ((p.balance - min) / span) * (h * 0.78) - h * 0.08;
    return { x, y };
  });
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return { line, area };
}

function UsdcTrustlineInline({
  agentId,
  showReady = false,
}: {
  agentId: string | null;
  showReady?: boolean;
}) {
  const { data, loading, setData, error, reload } = useLoad(
    () => api.getUsdcTrustlineStatus(),
    [agentId],
  );
  const [busy, setBusy] = useState(false);

  if (!agentId || (loading && !data && !error)) return null;

  if (data?.ready) {
    if (!showReady) return null;
    return (
      <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-3.5 py-2.5 font-mono text-[11px] text-success">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        USDC TRUSTLINE OPEN
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
    } catch (err) {
      toast.error("Couldn't open USDC trustline", {
        description: err instanceof Error ? err.message : undefined,
        action: { label: "Retry", onClick: () => void open() },
      });
    } finally {
      setBusy(false);
    }
  };

  const blocked =
    error?.message === "wallet_not_provisioned" ||
    error?.message?.includes("wallet_not_provisioned");

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-elevated/50 px-3.5 py-3">
      <Coins className="size-4 shrink-0 text-teal" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] tracking-[0.08em]">OPEN USDC TRUSTLINE</p>
        <p className="text-xs text-muted-foreground">
          {blocked
            ? "Wallet is still provisioning — refresh in a moment."
            : "Required before this agent can hold or spend USDC. On testnet we fund XLM via Friendbot automatically."}
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => (blocked ? void reload() : void open())}
        disabled={busy || blocked}
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Opening…
          </>
        ) : blocked ? (
          "Waiting…"
        ) : (
          "Open trustline"
        )}
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const { selectedAgentId, selectedAgent, reloadAgents } = useAgentScope();
  const { data: wallet } = useLoad(() => api.getWallet(), [selectedAgentId]);
  const { data: policy, setData: setPolicy, reload: reloadPolicy } = useLoad(
    () => api.getPolicy(),
    [selectedAgentId],
  );
  const { data: recentTxs } = useLoad(
    () => api.getRecentTransactions(5),
    [selectedAgentId],
  );
  const { data: reputation } = useLoad(
    () => api.getReputation(),
    [selectedAgentId],
  );
  const { data: history, loading: historyLoading } = useLoad(
    () => api.getBalanceHistory("30d"),
    [selectedAgentId],
  );
  const [pauseBusy, setPauseBusy] = useState(false);
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);

  const usdc = wallet?.usdcBalance ?? 0;
  // Overview is USDC-denominated: show actual Circle USDC, not XLM·FX.
  const liquidUsd = usdc;
  const blendUsd = 0;
  const reservedUsd = 0;
  const totalUsd = liquidUsd + blendUsd + reservedUsd;
  const unfunded = wallet != null && wallet.balanceXLM <= 0 && usdc <= 0;
  const split = splitPcts(liquidUsd, blendUsd, reservedUsd);

  const dailyCap = policy?.dailyCapUSD ?? 0;
  const spent = wallet?.spendTodayUSD ?? 0;
  const atRisk = Math.max(0, dailyCap - spent);
  const spentMarker =
    dailyCap > 0 ? Math.min(98, Math.max(2, (spent / dailyCap) * 100)) : 2;

  const spark = useMemo(() => sparkPath(history ?? []), [history]);
  const delta =
    wallet != null
      ? `${wallet.change24hPct >= 0 ? "+" : ""}${wallet.change24hPct.toFixed(2)}%`
      : "—";

  const isPaused =
    policy?.paused === true || selectedAgent?.status === "paused";

  const togglePause = async () => {
    if (!selectedAgent) return;
    const nextPaused = !isPaused;
    setPauseBusy(true);
    setPolicy((prev) => (prev ? { ...prev, paused: nextPaused } : prev));
    try {
      await api.setPolicyPaused(nextPaused);
      reloadAgents();
      reloadPolicy();
      toast.success(nextPaused ? "Agent paused" : "Agent resumed");
    } catch {
      setPolicy((prev) => (prev ? { ...prev, paused: !nextPaused } : prev));
      toast.error("Couldn't update pause state");
    } finally {
      setPauseBusy(false);
    }
  };

  return (
    <div>
      <div className="relative overflow-hidden pt-0 pb-6">
        <PageEcho>EXPOSURE</PageEcho>
        <SectionRule>AGENT OVERVIEW</SectionRule>
        <h1 className="page-title relative">
          {selectedAgent?.name ?? "Overview"}
        </h1>
        {selectedAgent ? (
          <div className="relative mt-3 flex flex-wrap items-center gap-5 font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {selectedAgent.address !== "—"
                ? truncMiddle(selectedAgent.address, 8, 4)
                : "provisioning…"}
              {selectedAgent.address !== "—" ? (
                <CopyButton
                  value={selectedAgent.address}
                  label="Copy address"
                  className="size-5 text-subtle hover:text-muted-foreground"
                />
              ) : null}
            </span>
            <span className="text-subtle" aria-hidden>
              ·
            </span>
            <span className="uppercase">
              {agentAttribution(selectedAgent)}
            </span>
            <span className="text-subtle" aria-hidden>
              ·
            </span>
            <span>
              LAST SPEND{" "}
              {(() => {
                const t = new Date(selectedAgent.lastActive);
                if (Number.isNaN(t.getTime())) return timeAgo(selectedAgent.lastActive);
                return t
                  .toLocaleTimeString("en-GB", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    timeZone: "UTC",
                  })
                  .concat(" UTC");
              })()}
            </span>
          </div>
        ) : null}
      </div>

      <section className="soft-panel-lg grid overflow-hidden lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="border-b border-border px-[34px] pt-[30px] pb-7 lg:border-r lg:border-b-0">
          {!wallet ? (
            <ListSkeleton rows={6} />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-x-[30px] gap-y-[18px]">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                    TOTAL UNDER AGENT CONTROL
                  </p>
                  <div className="relative mt-3 flex items-baseline gap-2.5">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -top-[46px] -right-[30px] -bottom-10 -left-10 bg-[radial-gradient(58%_62%_at_24%_50%,var(--ambient-a),transparent_72%)]"
                    />
                    <span className="relative font-mono text-[clamp(2.5rem,4vw,3.75rem)] font-bold leading-[1.05] tracking-[-0.03em] tabular-nums">
                      {fmtUsdc(totalUsd)}
                    </span>
                    <span className="relative font-mono text-sm tracking-[0.08em] text-muted-foreground">
                      USDC
                    </span>
                  </div>
                </div>
                <div className="min-w-[140px] shrink-0 text-right">
                  <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                    SPEND LEFT TODAY
                  </p>
                  <p className="mt-2.5 font-mono text-[26px] text-primary-2 tabular-nums">
                    {fmtUsdc(atRisk)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.06em] text-subtle whitespace-nowrap">
                    DAILY CAP LEFT
                  </p>
                </div>
              </div>

              <div className="mt-[34px]">
                <ExposureBar
                  liquidPct={split.liquidPct}
                  yieldPct={split.yieldPct}
                  reservedPct={split.reservedPct}
                  spentMarkerPct={spentMarker}
                />
                <div className="relative h-5 overflow-visible">
                  <span
                    className="absolute top-1.5 font-mono text-[9px] tracking-[0.12em] text-primary-2 whitespace-nowrap"
                    style={
                      spentMarker < 12
                        ? { left: 0, transform: "none" }
                        : spentMarker > 88
                          ? { left: "100%", transform: "translateX(-100%)" }
                          : { left: `${spentMarker}%`, transform: "translateX(-50%)" }
                    }
                  >
                    SPENT TODAY {fmtUsdc(spent)}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-[30px] sm:grid-cols-3">
                  <div className="py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="size-2 shrink-0 bg-warm" aria-hidden />
                      <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                        LIQUID BAND
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-[19px] tabular-nums">
                      {fmtUsdc(liquidUsd)}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-subtle">SPENDABLE NOW</p>
                  </div>
                  <div className="py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="size-2 shrink-0 bg-primary" aria-hidden />
                      <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                        IN BLEND YIELD
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-[19px] tabular-nums">
                      {fmtUsdc(blendUsd)}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-subtle">
                      ~5S TO UNWIND
                    </p>
                  </div>
                  <div className="py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 border border-border-strong bg-[var(--panel-3)]"
                        aria-hidden
                      />
                      <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                        COMMITTED
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-[19px] tabular-nums">
                      {fmtUsdc(reservedUsd)}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-subtle">OPEN MPP CHANNELS</p>
                  </div>
                </div>
              </div>

              <UsdcTrustlineInline agentId={selectedAgentId} showReady={unfunded} />

              <div className="mt-7 flex flex-wrap items-center gap-2.5 border-t border-border pt-5">
                <Link
                  href="/treasury"
                  className="inline-flex shrink-0 items-center rounded-full px-[22px] py-[11px] text-[13px] font-semibold"
                  style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
                >
                  Deposit funds
                </Link>
                <Link
                  href="/policy"
                  className="inline-flex shrink-0 items-center rounded-full border border-border-strong px-5 py-[11px] text-[13px] text-muted-foreground"
                >
                  Adjust limits
                </Link>
                <div className="min-w-2 flex-1" />
                <button
                  type="button"
                  disabled={pauseBusy || !selectedAgent}
                  onClick={() => setPauseConfirmOpen(true)}
                  className="inline-flex shrink-0 items-center rounded-full border border-border-strong px-5 py-[11px] text-[13px] text-destructive disabled:opacity-50"
                >
                  {pauseBusy ? (
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  ) : null}
                  {isPaused ? "Resume agent" : "Pause agent"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col px-[34px] pt-[30px] pb-7">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
              BALANCE · 30 DAYS
            </span>
            <span
              className={cn(
                "font-mono text-[11px]",
                (wallet?.change24hPct ?? 0) >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {delta}
            </span>
          </div>
          {historyLoading && !history ? (
            <ChartSkeleton height={116} className="mt-4" />
          ) : (
            <svg
              viewBox="0 0 300 96"
              preserveAspectRatio="none"
              className="mt-4 block h-[116px] w-full shrink-0 overflow-visible"
              aria-hidden
            >
              <defs>
                <linearGradient id="nb-trend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.34} />
                  <stop offset="55%" stopColor="var(--primary)" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <line x1="0" y1="95" x2="300" y2="95" stroke="var(--border)" strokeWidth="1" />
              <line
                x1="0"
                y1="48"
                x2="300"
                y2="48"
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="2 5"
              />
              <polyline points={spark.area} fill="url(#nb-trend)" stroke="none" />
              <polyline
                points={spark.line}
                fill="none"
                stroke="var(--primary-2)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="[filter:drop-shadow(0_0_6px_var(--ambient-a))]"
              />
            </svg>
          )}
          <div className="mt-1.5 flex justify-between font-mono text-[9px] tracking-[0.1em] text-subtle">
            <span>30D AGO</span>
            <span>NOW</span>
          </div>

          <div className="mt-6 flex flex-col gap-1">
            <div className="flex items-center justify-between border-t border-border py-3.5">
              <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                YIELD EARNED · 30D
              </span>
              <span className="font-mono text-[15px] tabular-nums">
                {wallet
                  ? `+${fmtUsdc(wallet.yield30dXLM * (wallet.usdPerXlm ?? 0))}`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border py-3.5">
              <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                BLEND APY · LIVE
              </span>
              <span className="font-mono text-[15px] text-primary tabular-nums">
                {wallet ? `${wallet.apyPct.toFixed(2)}%` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border py-3.5">
              <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                REPUTATION · 8004
              </span>
              <Link href="/reputation" className="font-mono text-[15px] hover:underline">
                {reputation ? String(reputation.score) : "—"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="soft-panel px-7 pt-6 pb-5">
          <div className="mb-4 flex items-center justify-between">
            <SectionRule className="mb-0">RECENT ACTIVITY</SectionRule>
            <Link
              href="/transactions"
              className="font-mono text-[10px] tracking-[0.12em] text-primary-2"
            >
              FULL LOG →
            </Link>
          </div>
          {!recentTxs ? (
            <ListSkeleton rows={5} />
          ) : recentTxs.length === 0 ? (
            <p className="py-8 text-center font-mono text-[12px] text-muted-foreground">
              No transactions yet.
            </p>
          ) : (
            recentTxs.map((tx) => {
              const rail =
                tx.type === "x402" || tx.type === "mpp"
                  ? "text-primary"
                  : tx.type === "transfer"
                    ? "text-primary-2"
                    : tx.status === "failed"
                      ? "text-destructive"
                      : "text-foreground";
              const status =
                tx.status === "confirmed"
                  ? "SETTLED"
                  : tx.status === "pending"
                    ? "OPEN"
                    : "REJECTED";
              const time = new Date(tx.time);
              const stamp = Number.isNaN(time.getTime())
                ? timeAgo(tx.time)
                : time.toLocaleTimeString("en-US", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });
              return (
                <div
                  key={tx.id}
                  className={cn(
                    "grid grid-cols-[64px_92px_minmax(0,1fr)_auto_88px] items-center gap-3.5 border-t border-border py-3 font-mono text-[11px]",
                    tx.status === "failed" && "bg-[var(--accent-soft)]",
                  )}
                >
                  <span className="text-subtle">{stamp}</span>
                  <span className={cn("text-[10px] tracking-[0.1em]", rail)}>
                    {tx.type === "blend_deposit" || tx.type === "blend_withdraw"
                      ? "YIELD"
                      : tx.status === "failed"
                        ? "BLOCKED"
                        : tx.type.toUpperCase()}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {tx.memo || truncMiddle(tx.to, 6, 4)}
                  </span>
                  <span className="text-right tabular-nums">
                    {tx.amount < 0 ? "" : tx.type === "blend_deposit" || tx.type === "swap" ? "+" : "−"}
                    {fmtAmount(Math.abs(tx.amount), tx.asset).replace(/^[+-]/, "")}
                  </span>
                  <span
                    className={cn(
                      "text-right text-[9px] tracking-[0.12em] text-subtle",
                      tx.status === "failed" && "text-destructive",
                    )}
                  >
                    {status}
                  </span>
                </div>
              );
            })
          )}
        </section>

        <section className="soft-panel px-7 pt-6 pb-5">
          <SectionRule>POLICY IN FORCE</SectionRule>
          {!policy ? (
            <ListSkeleton rows={5} />
          ) : (
            <div className="space-y-0">
              <div className="flex items-center justify-between border-t border-border py-3">
                <span className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
                  PER TX
                </span>
                <span className="font-mono text-[13px] tabular-nums">
                  {fmtUsdc(policy.perCallCapXLM)} USDC
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border py-3">
                <span className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
                  PER DAY
                </span>
                <span className="font-mono text-[13px] tabular-nums">
                  {fmtUsdc(wallet?.spendTodayUSD ?? 0)} / {fmtUsdc(policy.dailyCapUSD)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border py-3">
                <span className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
                  COUNTERPARTIES
                </span>
                <span className="font-mono text-[13px]">
                  ALLOW LIST · {policy.entries.filter((e) => e.kind === "allow").length}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border py-3">
                <span className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
                  RAILS
                </span>
                <span className="font-mono text-[13px]">TRANSFER · SWAP · X402 · MPP</span>
              </div>
              <div className="flex items-center justify-between border-t border-border py-3">
                <span className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
                  STATUS
                </span>
                <span
                  className={cn(
                    "font-mono text-[13px]",
                    isPaused ? "text-destructive" : "text-success",
                  )}
                >
                  {isPaused ? "PAUSED" : "ACTIVE"}
                </span>
              </div>
              <Link
                href="/policy"
                className="mt-4 flex w-full items-center justify-center rounded-full border border-border-strong py-2.5 text-[12px] text-muted-foreground"
              >
                Open spending policy
              </Link>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={pauseConfirmOpen}
        onOpenChange={setPauseConfirmOpen}
        title={isPaused ? "Resume this agent?" : "Pause this agent?"}
        description={
          isPaused
            ? "Payments, swaps, and treasury moves will be allowed again under the current caps."
            : "Every payment rail for this agent will be blocked immediately. Funds stay in the wallet — nothing is lost."
        }
        confirmLabel={isPaused ? "Resume agent" : "Pause agent"}
        onConfirm={togglePause}
      />
    </div>
  );
}
