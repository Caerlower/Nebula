"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { PageEcho, SectionRule, SplitBar } from "@/components/design/primitives";
import { agentAttribution } from "@/components/shared/status-badges";
import { useLoad } from "@/hooks/use-load";
import * as api from "@/lib/api";
import { cn, fmtUsdc } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import type { Agent } from "@/types/domain";

const fmtCap = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const ROW_COLS =
  "md:grid-cols-[16px_minmax(0,1.4fr)_150px_minmax(0,1fr)_140px_72px_28px]";

function statusDotClass(status: Agent["status"]): string {
  if (status === "active") return "bg-success";
  if (status === "paused") return "bg-warning";
  return "bg-subtle";
}

export default function AgentsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: agents, loading } = useLoad(() => api.getAgents(), []);
  const { setSelectedAgentId } = useAgentScope();
  const setCreateAgentOpen = useUIStore((s) => s.setCreateAgentOpen);

  const newAgent = () => setCreateAgentOpen(true);

  const filtered = agents ?? [];

  const fleetTotal = useMemo(() => {
    const usdc = (agents ?? []).reduce((s, a) => s + a.balanceUSDC, 0);
    return fmtUsdc(usdc);
  }, [agents]);

  const fleetExposed = useMemo(() => {
    const usdc = (agents ?? []).reduce((s, a) => s + a.spendTodayUSD, 0);
    return fmtUsdc(usdc);
  }, [agents]);

  const fleetYield = useMemo(() => {
    // Per-agent Blend positions are not on the fleet list yet.
    return fmtUsdc(0);
  }, []);

  const enterWorkspace = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    router.push("/dashboard");
  };

  const accountLabel = user?.name
    ? `ACCOUNT · ${user.name.toUpperCase()}`
    : "ACCOUNT";

  return (
    <div>
      <div className="relative overflow-hidden pb-6">
        <PageEcho>FLEET</PageEcho>
        <SectionRule>{accountLabel}</SectionRule>
        <h1 className="page-title relative">All agents</h1>
      </div>

      {loading || !agents ? (
        <div className="soft-panel-lg h-40 animate-pulse" />
      ) : agents.length === 0 ? (
        <div className="soft-panel-lg px-10 py-24 text-center">
          <p className="text-[clamp(2.5rem,8vw,5.5rem)] font-semibold tracking-[-0.022em] leading-[1.1] text-subtle">
            No agents
          </p>
          <p className="mx-auto mt-5 max-w-md text-[15px] text-pretty text-muted-foreground">
            Every agent gets its own custodial Stellar wallet, a spending band you set,
            and policy it can&apos;t bypass. Nothing moves until you fund it.
          </p>
          <button
            type="button"
            onClick={newAgent}
            className="mt-7 inline-flex rounded-full px-[26px] py-3 text-[13px] font-semibold"
            style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
          >
            Create your first agent
          </button>
        </div>
      ) : (
        <div>
          <div className="soft-panel-lg grid items-end gap-8 px-8 py-7 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                TOTAL UNDER MANAGEMENT
              </p>
              <p className="mt-2.5 font-mono text-[clamp(1.75rem,3vw,2.375rem)] tracking-[-0.03em] tabular-nums">
                {fleetTotal}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                EXPOSED TODAY
              </p>
              <p className="mt-3 font-mono text-[22px] text-primary-2 tabular-nums">
                {fleetExposed}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                IN YIELD
              </p>
              <p className="mt-3 font-mono text-[22px] tabular-nums">{fleetYield}</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={newAgent}
                className="inline-flex shrink-0 items-center justify-center rounded-full px-[22px] py-[11px] text-[13px] font-semibold"
                style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
              >
                New agent
              </button>
            </div>
          </div>

          <div className="soft-panel-lg mt-4 overflow-hidden">
            <div
              className={cn(
                "hidden items-center gap-[18px] border-b border-border px-6 py-2.5 font-mono text-[9px] tracking-[0.16em] text-subtle md:grid",
                ROW_COLS,
              )}
            >
              <span />
              <span>AGENT</span>
              <span className="text-right">BALANCE</span>
              <span>LIQUID / YIELD / COMMITTED</span>
              <span>DAILY CAP USED</span>
              <span className="text-right">8004</span>
              <span />
            </div>

            {filtered.map((agent) => {
              const spent = agent.spendTodayUSD;
              const cap = agent.dailyCapUSD;
              const capPct =
                cap != null && cap > 0
                  ? Math.min(100, (spent / cap) * 100)
                  : 0;
              const liquidPct = agent.balanceUSDC > 0 ? 100 : 0;

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => enterWorkspace(agent)}
                  className={cn(
                    "grid w-full grid-cols-1 items-center gap-3 border-b border-border px-6 py-4 text-left last:border-b-0 hover:bg-elevated/40 md:gap-[18px] md:py-[18px]",
                    ROW_COLS,
                  )}
                >
                  <span
                    className={cn(
                      "hidden size-[7px] rounded-full md:block",
                      statusDotClass(agent.status),
                    )}
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-[7px] rounded-full md:hidden",
                          statusDotClass(agent.status),
                        )}
                        aria-hidden
                      />
                      <span className="truncate font-mono text-[13px]">
                        {agent.name}
                      </span>
                    </span>
                    <span className="truncate font-mono text-[10px] tracking-[0.06em] text-subtle">
                      {agentAttribution(agent)}
                    </span>
                  </span>
                  <span className="font-mono text-[17px] tabular-nums md:text-right">
                    {fmtUsdc(agent.balanceUSDC)}
                  </span>
                  <span className="hidden md:block">
                    <SplitBar
                      liquidPct={liquidPct}
                      yieldPct={0}
                      height={8}
                      className="border border-border bg-elevated"
                    />
                  </span>
                  <span className="hidden font-mono text-[10px] tracking-[0.06em] text-muted-foreground md:block">
                    {fmtCap(spent)}
                    {" / "}
                    {cap != null ? fmtCap(cap) : "—"}
                    <span className="mt-1.5 block h-[3px] w-full bg-border">
                      <span
                        className="block h-[3px] bg-primary-2 transition-[width] duration-500"
                        style={{ width: `${capPct}%` }}
                      />
                    </span>
                  </span>
                  <span
                    className={cn(
                      "hidden text-right font-mono text-[13px] md:block",
                      agent.stellar8004AgentId != null
                        ? "text-foreground"
                        : "text-subtle",
                    )}
                  >
                    {agent.stellar8004AgentId != null
                      ? agent.stellar8004AgentId
                      : "—"}
                  </span>
                  <span
                    className="hidden justify-self-end font-mono text-[11px] text-subtle md:block"
                    aria-hidden
                  >
                    →
                  </span>

                  {/* Mobile-only meters */}
                  <span className="flex items-center justify-between gap-3 md:hidden">
                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground">
                        DAILY · {fmtCap(spent)} / {cap != null ? fmtCap(cap) : "—"}
                      </span>
                      <span className="h-[3px] w-full bg-border">
                        <span
                          className="block h-[3px] bg-primary-2"
                          style={{ width: `${capPct}%` }}
                        />
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-subtle" aria-hidden>
                      →
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
