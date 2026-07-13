"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, KeyRound, Loader2, Pencil, Settings2, X } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CopyButton } from "@/components/shared/copy-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ScoreRing } from "@/components/shared/score-ring";
import { ListSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import {
  AgentStatusBadge,
  FrameworkLabel,
  TxStatusBadge,
  TxTypeLabel,
} from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as api from "@/lib/api";
import { fmtAmount, fmtDate, fmtUSD, timeAgo, truncMiddle } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const agentId = params.id;

  const { data: agent, loading, setData: setAgent } = useLoad(() => api.getAgent(agentId), [agentId]);
  const { data: txs } = useLoad(() => api.getAgentTransactions(agentId), [agentId]);
  const { data: override, setData: setOverride } = useLoad(
    () => api.getAgentPolicyOverride(agentId),
    [agentId],
  );
  const { data: keys, setData: setKeys } = useLoad(async () => {
    const all = await api.getApiKeys();
    return all.filter((k) => k.agentId === agentId);
  }, [agentId]);
  const { data: reputation } = useLoad(() => api.getReputation(), []);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);
  const [capDraft, setCapDraft] = useState<{ daily: string; perTx: string } | null>(null);
  const [savingOverride, setSavingOverride] = useState(false);

  if (loading) {
    return <ListSkeleton rows={5} className="max-w-xl" />;
  }

  if (!agent) {
    return (
      <EmptyState
        title="Agent not found"
        subtitle="It may have been deleted, or the link is stale."
        actionLabel="Back to agents"
        onAction={() => router.push("/agents")}
      />
    );
  }

  const saveName = async () => {
    const name = nameDraft.trim();
    setEditingName(false);
    if (!name || name === agent.name) return;
    const previous = agent;
    setAgent({ ...agent, name });
    try {
      await api.updateAgent(agent.id, { name });
      toast.success("Agent renamed");
    } catch {
      setAgent(previous);
      toast.error("Couldn't rename the agent");
    }
  };

  const togglePause = async () => {
    const nextStatus = agent.status === "paused" ? "active" : "paused";
    const previous = agent;
    setAgent({ ...agent, status: nextStatus });
    try {
      await api.updateAgent(agent.id, { status: nextStatus });
      toast.success(`${agent.name} ${nextStatus === "paused" ? "paused" : "resumed"}`);
    } catch {
      setAgent(previous);
      toast.error("Couldn't update status", {
        action: { label: "Retry", onClick: () => void togglePause() },
      });
    }
  };

  const rotateKeys = async () => {
    try {
      const { prefix } = await api.rotateAgentKeys(agent.id);
      toast.success("Keys rotated", { description: `New prefix ${prefix}…` });
    } catch {
      toast.error("Key rotation failed", {
        action: { label: "Retry", onClick: () => void rotateKeys() },
      });
    }
  };

  const saveOverride = async () => {
    if (!capDraft) return;
    setSavingOverride(true);
    const daily = capDraft.daily.trim() === "" ? null : Number.parseFloat(capDraft.daily);
    const perTx = capDraft.perTx.trim() === "" ? null : Number.parseFloat(capDraft.perTx);
    try {
      const next = await api.updateAgentPolicyOverride(agent.id, {
        dailyCapUSD: Number.isFinite(daily as number) ? daily : null,
        perTxCapUSD: Number.isFinite(perTx as number) ? perTx : null,
      });
      setOverride(next);
      setCapDraft(null);
      toast.success("Agent policy override saved");
    } catch {
      toast.error("Couldn't save the override", {
        action: { label: "Retry", onClick: () => void saveOverride() },
      });
    } finally {
      setSavingOverride(false);
    }
  };

  const revokeKey = async (id: string) => {
    try {
      await api.revokeApiKey(id);
      setKeys((keys ?? []).filter((k) => k.id !== id));
      toast.success("Key revoked");
    } catch {
      toast.error("Couldn't revoke the key");
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push("/agents")}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        aria-label="Back to agents"
      >
        <ChevronLeft className="size-4" aria-hidden /> Agents
      </button>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        {editingName ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void saveName();
            }}
          >
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-10 w-56 font-display text-2xl"
              autoFocus
              aria-label="Agent name"
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingName(false);
              }}
            />
            <Button type="submit" size="icon" variant="ghost" className="size-8" aria-label="Save name">
              <Check className="size-4 text-success" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => setEditingName(false)}
              aria-label="Cancel rename"
            >
              <X className="size-4" />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            className="group inline-flex items-center gap-2"
            onClick={() => {
              setNameDraft(agent.name);
              setEditingName(true);
            }}
            aria-label={`Rename ${agent.name}`}
          >
            <h1 className="page-title">{agent.name}</h1>
            <Pencil
              className="size-4 text-subtle opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          </button>
        )}
        <FrameworkLabel framework={agent.framework} />
        <AgentStatusBadge status={agent.status} />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={() => void togglePause()}>
            {agent.status === "paused" ? "Resume" : "Pause"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" aria-label="Agent settings">
                <Settings2 className="size-4" /> Settings
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void rotateKeys()}>
                <KeyRound className="size-4" /> Rotate keys
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteOpen(true)}>
                Delete agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="mb-8 flex items-center gap-1 font-mono text-[13px] text-muted-foreground">
        {truncMiddle(agent.address, 8, 8)}
        <CopyButton value={agent.address} label="Copy agent address" />
      </p>

      <Tabs defaultValue="activity">
        <TabsList aria-label="Agent sections">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="policy">Policy</TabsTrigger>
          <TabsTrigger value="keys">API keys</TabsTrigger>
          <TabsTrigger value="reputation">Reputation</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-5">
          <Card className="overflow-hidden">
            {!txs ? (
              <TableSkeleton rows={6} cols={4} className="p-5" />
            ) : txs.length === 0 ? (
              <EmptyState
                title="No activity yet"
                subtitle="Payments and treasury moves made by this agent will appear here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {txs.slice(0, 25).map((tx) => (
                  <li key={tx.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">
                      {timeAgo(tx.time)}
                    </span>
                    <TxTypeLabel type={tx.type} />
                    <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                      → {truncMiddle(tx.to)}
                    </span>
                    <span className="ml-auto font-mono text-[13px] tabular">
                      {fmtAmount(tx.amount, tx.asset)}
                    </span>
                    <TxStatusBadge status={tx.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="policy" className="mt-5">
          <Card className="max-w-xl p-5">
            <p className="text-[13px] font-medium text-muted-foreground">
              Overrides on top of the global policy
            </p>
            {!override ? (
              <ListSkeleton rows={2} className="mt-4" />
            ) : capDraft ? (
              <form
                className="mt-4 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveOverride();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ov-daily">Daily cap (USD)</Label>
                    <Input
                      id="ov-daily"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="inherit"
                      value={capDraft.daily}
                      onChange={(e) => setCapDraft({ ...capDraft, daily: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ov-pertx">Per-transaction cap (USD)</Label>
                    <Input
                      id="ov-pertx"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="inherit"
                      value={capDraft.perTx}
                      onChange={(e) => setCapDraft({ ...capDraft, perTx: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={savingOverride}>
                    {savingOverride ? <Loader2 className="size-4 animate-spin" /> : null}
                    Save override
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setCapDraft(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-4">
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Daily cap</dt>
                    <dd className="font-mono tabular">
                      {override.dailyCapUSD != null ? fmtUSD(override.dailyCapUSD) : "Inherits global"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Per-transaction cap</dt>
                    <dd className="font-mono tabular">
                      {override.perTxCapUSD != null ? fmtUSD(override.perTxCapUSD) : "Inherits global"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-[13px] text-muted-foreground">{override.note}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() =>
                    setCapDraft({
                      daily: override.dailyCapUSD != null ? String(override.dailyCapUSD) : "",
                      perTx: override.perTxCapUSD != null ? String(override.perTxCapUSD) : "",
                    })
                  }
                >
                  Edit override
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="keys" className="mt-5">
          <Card className="overflow-hidden">
            {!keys ? (
              <TableSkeleton rows={2} cols={4} className="p-5" />
            ) : keys.length === 0 ? (
              <EmptyState
                title="No keys for this agent"
                subtitle="Create one on the Connect page and assign it to this agent."
                actionLabel="Go to Connect"
                onAction={() => router.push("/connect")}
              />
            ) : (
              <ul className="divide-y divide-border">
                {keys.map((key) => (
                  <li key={key.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{key.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{key.prefix}…</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Created {fmtDate(key.createdAt)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {key.lastUsed ? `Used ${timeAgo(key.lastUsed)}` : "Never used"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setRevokeKeyId(key.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="reputation" className="mt-5">
          <Card className="max-w-xl p-6">
            {!reputation ? (
              <ListSkeleton rows={4} />
            ) : (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <ScoreRing
                  score={reputation.score}
                  max={reputation.scoreMax}
                  size={132}
                  label={`of ${reputation.scoreMax}`}
                />
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {agent.name} shares this wallet&apos;s on-chain Stellar8004
                    identity (avgScore 0–100). Call{" "}
                    <code className="text-xs">register_identity</code> from MCP
                    if it is not registered yet.
                  </p>
                  {reputation.components.map((component) => (
                    <div key={component.key}>
                      <div className="flex justify-between text-[13px]">
                        <span>{component.label}</span>
                        <span className="font-mono tabular text-muted-foreground">
                          {component.score}
                          {component.key === "average" ? "/100" : ""}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                        <div
                          className="h-full rounded-full bg-chart-4"
                          style={{
                            width: `${Math.min(100, (component.score / Math.max(component.max, 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${agent.name}?`}
        description="Its keys stop working immediately. Transaction history is retained."
        confirmLabel="Delete agent"
        destructive
        typeToConfirm={agent.name}
        onConfirm={async () => {
          try {
            await api.deleteAgent(agent.id);
            toast.success(`${agent.name} deleted`);
            router.replace("/agents");
          } catch {
            toast.error("Couldn't delete the agent");
          }
        }}
      />

      <ConfirmDialog
        open={revokeKeyId != null}
        onOpenChange={(open) => !open && setRevokeKeyId(null)}
        title="Revoke this key?"
        description="Anything using it loses access immediately."
        confirmLabel="Revoke key"
        destructive
        onConfirm={async () => {
          if (revokeKeyId) await revokeKey(revokeKeyId);
        }}
      />
    </div>
  );
}
