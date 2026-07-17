"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronDown, LayoutGrid, Plus } from "lucide-react";

import { AgentAvatar } from "@/components/agent-scope/agent-avatar";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { StatusDot, AGENT_STATUS_META } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmtXLM, truncMiddle } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Bloom-style workspace switcher: shows the active agent and lets the user jump
 * between agents (re-scoping every page) or create a new one. Auth wallets are
 * never shown here — only real agents.
 */
export function AgentSwitcher() {
  const router = useRouter();
  const { agents, loading, selectedAgent, setSelectedAgentId } = useAgentScope();

  const newAgent = () => {
    router.push("/agents/new");
  };

  if (loading && !selectedAgent) {
    return (
      <div className="h-9 w-44 animate-pulse rounded-xl border border-border bg-elevated/50" />
    );
  }

  if (agents.length === 0) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" onClick={newAgent}>
        <Plus className="size-3.5" aria-hidden />
        New agent
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="pressable group flex h-9 max-w-[13rem] items-center gap-2 rounded-lg border border-border bg-surface/70 px-3 text-left shadow-[var(--card-shadow)] backdrop-blur transition-colors hover:border-border-strong hover:bg-elevated/60"
          aria-label="Switch agent workspace"
        >
          <span className="min-w-0 truncate text-sm font-semibold leading-none">
            {selectedAgent?.name ?? "Select agent"}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Your agents
        </DropdownMenuLabel>
        {agents.map((agent) => {
          const active = agent.id === selectedAgent?.id;
          return (
            <DropdownMenuItem
              key={agent.id}
              className="gap-2.5 py-2"
              onSelect={() => setSelectedAgentId(agent.id)}
            >
              <AgentAvatar name={agent.name} seed={agent.id} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{agent.name}</span>
                  <StatusDot tone={AGENT_STATUS_META[agent.status].tone} />
                </div>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                  {agent.address !== "—"
                    ? `${truncMiddle(agent.address, 4, 4)} · ${fmtXLM(agent.balanceXLM)} XLM`
                    : "wallet provisioning…"}
                </span>
              </div>
              <Check
                className={cn(
                  "size-4 shrink-0 text-primary",
                  active ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 py-2" onSelect={() => router.push("/agents")}>
          <LayoutGrid className="size-4" aria-hidden />
          All agents
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 py-2 text-primary" onSelect={newAgent}>
          <Plus className="size-4" aria-hidden />
          New agent
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
