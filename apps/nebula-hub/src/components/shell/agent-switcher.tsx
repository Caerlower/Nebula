"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { SplitBar, splitPcts } from "@/components/design/primitives";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AGENT_STATUS_META } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLoad } from "@/hooks/use-load";
import * as api from "@/lib/api";
import { cn, fmtUsdc, fmtXLM, truncMiddle } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";

/**
 * Workspace switcher — Claude Design dropdown with fleet split bars.
 */
export function AgentSwitcher() {
  const router = useRouter();
  const { agents, loading, selectedAgent, setSelectedAgentId, reloadAgents } =
    useAgentScope();
  const setCreateAgentOpen = useUIStore((s) => s.setCreateAgentOpen);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: wallet } = useLoad(
    () => (selectedAgent ? api.getWallet() : Promise.resolve(null)),
    [selectedAgent?.id],
  );

  const selectedSplit = useMemo(() => {
    if (wallet) {
      return splitPcts(wallet.liquidXLM, wallet.blendXLM);
    }
    return { liquidPct: 100, yieldPct: 0, reservedPct: 0 };
  }, [wallet]);

  const fleetTotal = useMemo(() => {
    const usdc = agents.reduce((s, a) => s + (a.balanceUSDC ?? 0), 0);
    return `$${fmtUsdc(usdc)}`;
  }, [agents]);

  const newAgent = () => {
    setOpen(false);
    setCreateAgentOpen(true);
  };

  if (loading && !selectedAgent) {
    return (
      <div className="h-10 w-56 animate-pulse rounded-[14px] border border-border bg-elevated/50" />
    );
  }

  if (agents.length === 0) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5 font-mono text-[11px]" onClick={newAgent}>
        + NEW AGENT
      </Button>
    );
  }

  const balanceLabel = wallet
    ? fmtUsdc(wallet.usdcBalance ?? 0)
    : selectedAgent
      ? fmtUsdc(selectedAgent.balanceUSDC)
      : "—";

  const idLabel =
    selectedAgent?.address && selectedAgent.address !== "—"
      ? truncMiddle(selectedAgent.address, 4, 4)
      : selectedAgent
        ? truncMiddle(selectedAgent.id, 4, 4)
        : "";

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex max-w-[min(100vw-8rem,28rem)] shrink-0 items-center gap-3.5 rounded-[14px] border border-border bg-surface py-[7px] pr-3.5 pl-3 shadow-[var(--card-shadow)]"
            aria-label="Switch agent workspace"
            aria-haspopup="dialog"
          >
            <span
              aria-hidden
              className="size-[7px] shrink-0 rounded-full"
              style={{
                background:
                  selectedAgent?.status === "paused"
                    ? "var(--subtle-foreground)"
                    : selectedAgent?.status === "active"
                      ? "var(--success)"
                      : selectedAgent?.avatarColor || "var(--primary)",
                boxShadow: "0 0 0 3px var(--accent-soft)",
              }}
            />
            <span className="flex min-w-0 flex-col items-start gap-px leading-[1.25]">
              <span className="truncate font-mono text-[12px] tracking-[-0.01em]">
                {selectedAgent?.name ?? "Select agent"}
              </span>
              <span className="truncate font-mono text-[9px] tracking-[0.1em] text-subtle">
                {idLabel}
              </span>
            </span>
            <span className="flex flex-col items-end gap-[3px] leading-[1.25]">
              <span className="font-mono text-[12px] tabular-nums">{balanceLabel}</span>
              <SplitBar
                liquidPct={selectedSplit.liquidPct}
                yieldPct={selectedSplit.yieldPct}
                height={3}
                className="w-[66px]"
              />
            </span>
            <span className="font-mono text-[10px] text-subtle" aria-hidden>
              ▾
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(100vw-2rem,430px)] overflow-hidden rounded-2xl border-border-strong p-0 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.7)]"
        >
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <span className="font-mono text-[9px] tracking-[0.16em] text-subtle">
              SWITCH AGENT
            </span>
            <span className="font-mono text-[9px] tracking-[0.16em] text-subtle">
              FLEET {fleetTotal}
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {agents.map((agent) => {
              const active = agent.id === selectedAgent?.id;
              const status = AGENT_STATUS_META[agent.status].label.toUpperCase();
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    setSelectedAgentId(agent.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "grid w-full grid-cols-[14px_1fr_auto] items-center gap-3 border-b border-border px-3.5 py-3 text-left",
                    active ? "bg-surface" : "bg-transparent hover:bg-elevated/50",
                  )}
                >
                  <span
                    className="size-[7px] rounded-full"
                    style={{ background: agent.avatarColor || "var(--primary)" }}
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-mono text-[12px]">{agent.name}</span>
                    <SplitBar liquidPct={100} yieldPct={0} className="w-full" />
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-[12px] tabular-nums">
                      ${fmtUsdc(agent.balanceUSDC)}
                    </span>
                    <span className="font-mono text-[9px] tracking-[0.12em] text-subtle">
                      {status}
                      {agent.address !== "—"
                        ? ` · ${fmtXLM(agent.balanceXLM)} XLM`
                        : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={newAgent}
            className="w-full px-3.5 py-3 text-left font-mono text-[11px] tracking-[0.1em] text-primary-2"
          >
            + NEW AGENT
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/agents");
            }}
            className="w-full border-t border-border px-3.5 py-2.5 text-left font-mono text-[10px] tracking-[0.1em] text-subtle"
          >
            VIEW FLEET →
          </button>
          {selectedAgent ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmDelete(true);
              }}
              className="w-full border-t border-border px-3.5 py-2.5 text-left font-mono text-[10px] tracking-[0.1em] text-destructive"
            >
              DELETE CURRENT
            </button>
          ) : null}
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selectedAgent?.name ?? "agent"}?`}
        description="Its keys stop working immediately. Transaction history is retained."
        confirmLabel="Delete agent"
        destructive
        typeToConfirm={selectedAgent?.name}
        onConfirm={async () => {
          if (!selectedAgent) return;
          try {
            await api.deleteAgent(selectedAgent.id);
            toast.success(`${selectedAgent.name} deleted`);
            reloadAgents();
            router.push("/agents");
          } catch {
            toast.error(`Couldn't delete ${selectedAgent.name}`);
          }
        }}
      />
    </>
  );
}
