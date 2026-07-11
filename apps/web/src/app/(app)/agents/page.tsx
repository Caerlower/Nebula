"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  AgentStatusBadge,
  FRAMEWORK_META,
  FrameworkLabel,
} from "@/components/shared/status-badges";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as api from "@/lib/api";
import { fmtXLM, timeAgo } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import type { Agent, Framework } from "@/mocks/types";
import { useUIStore } from "@/stores/ui";

const createSchema = z.object({
  name: z.string().min(1, "Give your agent a name").max(40, "Keep it under 40 characters"),
  framework: z.enum(["claude-desktop", "claude-code", "custom-mcp", "openai-sdk"]),
});

type CreateValues = z.infer<typeof createSchema>;

function CreateAgentSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (agent: Agent) => void;
}) {
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", framework: "claude-desktop" },
  });

  const submit = async (values: CreateValues) => {
    try {
      const agent = await api.createAgent(values);
      onCreated(agent);
      onOpenChange(false);
      form.reset();
      toast.success(`${agent.name} created`, {
        description: "Grab an API key from Connect to bring it online.",
      });
    } catch {
      toast.error("Couldn't create the agent", { description: "Please try again." });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Create agent</SheetTitle>
          <SheetDescription>A new identity with its own keys, limits, and history.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="mt-6 space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Atlas" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="framework"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Framework</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid gap-2"
                    >
                      {(Object.keys(FRAMEWORK_META) as Framework[]).map((key) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm transition-colors has-[[data-state=checked]]:border-primary/60 has-[[data-state=checked]]:bg-elevated"
                        >
                          <RadioGroupItem value={key} aria-label={FRAMEWORK_META[key].label} />
                          <FrameworkLabel framework={key} />
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Create agent
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

export default function AgentsPage() {
  const router = useRouter();
  const { data: agents, loading, setData } = useLoad(() => api.getAgents(), []);
  const createOpen = useUIStore((s) => s.createAgentOpen);
  const setCreateOpen = useUIStore((s) => s.setCreateAgentOpen);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);

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
    toast.success(`${agent.name} deleted`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="agents"
        title="Agents"
        subtitle="Every agent connected to this wallet, with live status and spend."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Create agent
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {loading || !agents ? (
          <TableSkeleton rows={4} cols={6} className="p-5" />
        ) : agents.length === 0 ? (
          <EmptyState
            title="No agents yet"
            subtitle="Create your first agent and plug it into Claude, or any MCP client."
            actionLabel="Create agent"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Framework</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Txs today</TableHead>
                    <TableHead>Last active</TableHead>
                    <TableHead className="w-12" aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow
                      key={agent.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/agents/${agent.id}`)}
                    >
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell>
                        <FrameworkLabel framework={agent.framework} />
                      </TableCell>
                      <TableCell>
                        <AgentStatusBadge status={agent.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono tabular">
                        {fmtXLM(agent.balanceXLM)} XLM
                      </TableCell>
                      <TableCell className="text-right font-mono tabular">{agent.txToday}</TableCell>
                      <TableCell className="text-muted-foreground">{timeAgo(agent.lastActive)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                            <DropdownMenuItem onSelect={() => router.push(`/agents/${agent.id}`)}>
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void togglePause(agent)}>
                              {agent.status === "paused" ? "Resume" : "Pause"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => setDeleteTarget(agent)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {agents.map((agent) => (
                <li key={agent.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-5 py-4 text-left"
                    onClick={() => router.push(`/agents/${agent.id}`)}
                    aria-label={`Open ${agent.name}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{agent.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {FRAMEWORK_META[agent.framework].label} · {timeAgo(agent.lastActive)}
                      </p>
                      <p className="mt-1 font-mono text-[13px] tabular text-muted-foreground">
                        {fmtXLM(agent.balanceXLM)} XLM
                      </p>
                    </div>
                    <AgentStatusBadge status={agent.status} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <CreateAgentSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(agent) => setData([agent, ...(agents ?? [])])}
      />

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
