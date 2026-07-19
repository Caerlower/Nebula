"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutGrid, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AgentAvatar } from "@/components/agent-scope/agent-avatar";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusDot, AGENT_STATUS_META } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as api from "@/lib/api";
import { fmtXLM, truncMiddle } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Workspace switcher: a select-style trigger opens a searchable agent picker
 * (command-palette style), and the adjacent ⋯ menu carries agent actions.
 * Auth wallets are never shown here — only real agents.
 */
export function AgentSwitcher() {
  const router = useRouter();
  const { agents, loading, selectedAgent, setSelectedAgentId, reloadAgents } =
    useAgentScope();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const newAgent = () => {
    setPickerOpen(false);
    router.push("/agents/new");
  };

  if (loading && !selectedAgent) {
    return (
      <div className="h-9 w-44 animate-pulse rounded-lg border border-border bg-elevated/50" />
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
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="pressable group flex h-9 max-w-[15rem] items-center gap-2 rounded-lg border border-border bg-surface py-1 pl-1.5 pr-2.5 text-left transition-colors hover:border-border-strong hover:bg-elevated"
          aria-label="Switch agent workspace"
          aria-haspopup="dialog"
        >
          {selectedAgent ? (
            <AgentAvatar
              name={selectedAgent.name}
              seed={selectedAgent.id}
              color={selectedAgent.avatarColor}
              size="sm"
              className="size-6 rounded-md text-[10px] shadow-none"
            />
          ) : null}
          <span className="min-w-0 truncate text-sm font-semibold leading-normal">
            {selectedAgent?.name ?? "Select agent"}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              aria-label="Agent actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onSelect={newAgent}>
              <Plus className="size-4" aria-hidden />
              Add agent
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/agents")}>
              <LayoutGrid className="size-4" aria-hidden />
              All agents
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete agent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandDialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <CommandInput placeholder="Search agents or add a new one…" />
        <CommandList>
          <CommandEmpty>No agents match.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem
              keywords={["new", "add", "create"]}
              onSelect={newAgent}
              className="gap-2.5 rounded-lg py-2.5"
            >
              <span className="flex size-7 items-center justify-center rounded-lg border border-border bg-elevated/60">
                <Plus className="!size-4" aria-hidden />
              </span>
              <span className="font-medium">Add new agent</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Your agents">
            {agents.map((agent) => {
              const active = agent.id === selectedAgent?.id;
              return (
                <CommandItem
                  key={agent.id}
                  value={`${agent.name} ${agent.address} ${agent.id}`}
                  onSelect={() => {
                    setSelectedAgentId(agent.id);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    "gap-2.5 rounded-lg py-2.5",
                    active &&
                      "bg-primary/10 data-[selected=true]:bg-primary/15",
                  )}
                >
                  <AgentAvatar
                    name={agent.name}
                    seed={agent.id}
                    color={agent.avatarColor}
                    size="sm"
                    className="rounded-lg shadow-none"
                  />
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-medium leading-normal">
                      {agent.name}
                    </span>
                    <StatusDot tone={AGENT_STATUS_META[agent.status].tone} />
                    {active ? (
                      <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-primary">
                        Current
                      </span>
                    ) : null}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] tracking-tight text-subtle">
                    {agent.address !== "—"
                      ? `${truncMiddle(agent.address, 4, 4)} · ${fmtXLM(agent.balanceXLM)} XLM`
                      : "provisioning…"}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

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
