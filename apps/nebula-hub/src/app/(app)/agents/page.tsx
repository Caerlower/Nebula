"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CopyButton } from "@/components/shared/copy-button";
import {
  AgentStatusBadge,
  FrameworkLabel,
} from "@/components/shared/status-badges";
import { AgentAvatar } from "@/components/agent-scope/agent-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as api from "@/lib/api";
import { cn, fmtXLM, timeAgo, truncMiddle } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import type { Agent } from "@/types/domain";

const fmtUsdc = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function AgentCard({
  agent,
  onEnter,
  onTogglePause,
  onDelete,
}: {
  agent: Agent;
  onEnter: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEnter}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEnter();
        }
      }}
      aria-label={`Open ${agent.name} workspace`}
      className="pressable group flex cursor-pointer flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-[var(--card-shadow)] transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <AgentAvatar name={agent.name} seed={agent.id} color={agent.avatarColor} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{agent.name}</p>
          <div className="mt-1">
            <FrameworkLabel framework={agent.framework} />
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                aria-label={`Actions for ${agent.name}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEnter}>Open workspace</DropdownMenuItem>
              <DropdownMenuItem onSelect={onTogglePause}>
                {agent.status === "paused" ? "Resume" : "Pause"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p
        className={cn(
          "line-clamp-2 min-h-[2.75rem] text-[13px] leading-relaxed",
          agent.description ? "text-muted-foreground" : "text-subtle",
        )}
      >
        {agent.description || "No description"}
      </p>

      {/* footer block — anchored to the bottom so stats align across all cards */}
      <div className="mt-auto flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <AgentStatusBadge status={agent.status} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 font-mono text-xs text-muted-foreground"
          >
            {agent.address !== "—" ? (
              <>
                {truncMiddle(agent.address, 4, 4)}
                <CopyButton value={agent.address} label="Copy agent address" />
              </>
            ) : (
              <span>provisioning…</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div>
            <p className="stat-label text-[11px]">Balance</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="hero-number-sm tabular">
                {fmtUsdc(agent.balanceUSDC)}
              </span>
              <span className="text-xs text-muted-foreground">USDC</span>
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {fmtXLM(agent.balanceXLM)} XLM
            </p>
          </div>
          <div>
            <p className="stat-label text-[11px]">Txs today</p>
            <p className="mt-1 hero-number-sm tabular">{agent.txToday}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Active {timeAgo(agent.lastActive)}
        </p>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const router = useRouter();
  const { data: agents, loading, setData } = useLoad(() => api.getAgents(), []);
  const { reloadAgents, setSelectedAgentId } = useAgentScope();
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [query, setQuery] = useState("");

  const newAgent = () => router.push("/agents/new");

  const filtered = (agents ?? []).filter((a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) || a.address.toLowerCase().includes(q)
    );
  });

  const enterWorkspace = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    router.push("/dashboard");
  };

  const togglePause = async (agent: Agent) => {
    const nextStatus = agent.status === "paused" ? "active" : "paused";
    const previous = agents ?? [];
    setData(previous.map((a) => (a.id === agent.id ? { ...a, status: nextStatus } : a)));
    try {
      await api.updateAgent(agent.id, { status: nextStatus });
      toast.success(`${agent.name} ${nextStatus === "paused" ? "paused" : "resumed"}`);
    } catch {
      setData(previous);
      toast.error(`Couldn't update ${agent.name}`, {
        action: { label: "Retry", onClick: () => void togglePause(agent) },
      });
    }
  };

  const remove = async (agent: Agent) => {
    await api.deleteAgent(agent.id);
    setData((agents ?? []).filter((a) => a.id !== agent.id));
    reloadAgents();
    toast.success(`${agent.name} deleted`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="account home"
        title="Agents"
        subtitle="Pick an agent to open its workspace, or spin up a new one. Each agent has its own wallet, treasury, caps, and reputation."
        actions={
          <Button onClick={newAgent}>
            <Plus className="size-4" /> Create agent
          </Button>
        }
      />

      {agents && agents.length > 0 ? (
        <div className="mb-5 max-w-sm">
          <div className="flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-sm shadow-[var(--card-shadow)] focus-within:border-border-strong">
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents by name or address…"
              aria-label="Search agents"
              className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      ) : null}

      {loading || !agents ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-border bg-elevated/40"
            />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            title="No agents yet"
            subtitle="Create your first agent — it gets its own Stellar wallet, balance, treasury, caps, and reputation. Plug it into Claude or any MCP client."
            actionLabel="Create agent"
            onAction={newAgent}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEnter={() => enterWorkspace(agent)}
              onTogglePause={() => void togglePause(agent)}
              onDelete={() => setDeleteTarget(agent)}
            />
          ))}
          {query.trim() && filtered.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No agents match “{query.trim()}”.
            </p>
          ) : null}
          <button
            type="button"
            onClick={newAgent}
            className="pressable flex min-h-[11rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-dashed border-border">
              <Plus className="size-5" aria-hidden />
            </span>
            <span className="text-sm font-medium">New agent</span>
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "agent"}?`}
        description="Its keys stop working immediately. Transaction history is retained."
        confirmLabel="Delete agent"
        destructive
        typeToConfirm={deleteTarget?.name}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await remove(deleteTarget);
          } catch {
            toast.error(`Couldn't delete ${deleteTarget.name}`);
          }
        }}
      />
    </div>
  );
}
