"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, TriangleAlert } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CopyButton } from "@/components/shared/copy-button";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as api from "@/lib/api";
import { cn, fmtDate, timeAgo } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import type { ApiKey } from "@/types/domain";

const EXPIRATIONS = [
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
  { value: "180", label: "6 months", days: 180 },
  { value: "never", label: "Never", days: null },
] as const;

function kindBadge(kind: ApiKey["kind"]) {
  if (kind === "oauth") {
    return (
      <span className="rounded-full border border-border bg-elevated/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Claude.ai
      </span>
    );
  }
  if (kind === "unscoped") {
    return (
      <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
        Unscoped
      </span>
    );
  }
  return null;
}

function KeyRow({
  keyRow,
  onRevoke,
}: {
  keyRow: ApiKey;
  onRevoke: (key: ApiKey) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm">{keyRow.name}</p>
          {kindBadge(keyRow.kind)}
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {keyRow.prefix}…
        </p>
        {keyRow.kind === "unscoped" ? (
          <p className="mt-1 text-xs text-warning">
            Not bound to an agent — tools use your login / EOA wallet. Revoke
            and reconnect Claude with an agent selected.
          </p>
        ) : null}
      </div>
      <span className="text-xs text-muted-foreground">
        Created {fmtDate(keyRow.createdAt)}
      </span>
      <span className="w-28 text-xs text-muted-foreground">
        {keyRow.expiresAt
          ? `Expires ${fmtDate(keyRow.expiresAt)}`
          : "Never expires"}
      </span>
      <span className="w-24 text-xs text-muted-foreground">
        {keyRow.lastUsed ? `Used ${timeAgo(keyRow.lastUsed)}` : "Never used"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => onRevoke(keyRow)}
        aria-label={`Revoke ${keyRow.name}`}
      >
        Revoke
      </Button>
    </li>
  );
}

function CreateKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: ApiKey) => void;
}) {
  const [name, setName] = useState("");
  const [expiration, setExpiration] = useState<string>("30");
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setName("");
      setExpiration("30");
      setSecret(null);
    }
  };

  const generate = async () => {
    if (!name.trim()) {
      toast.error("Give the key a name");
      return;
    }
    setBusy(true);
    try {
      const days = EXPIRATIONS.find((e) => e.value === expiration)?.days ?? null;
      const { key, secret: newSecret } = await api.createApiKey({
        name: name.trim(),
        expiresInDays: days,
      });
      onCreated(key);
      setSecret(newSecret);
    } catch {
      toast.error("Couldn't create the key", {
        action: { label: "Retry", onClick: () => void generate() },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && close(next)}>
      <DialogContent className="sm:max-w-md">
        {secret ? (
          <>
            <DialogHeader>
              <DialogTitle>Key created</DialogTitle>
              <DialogDescription>
                Copy it now and store it somewhere safe.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-elevated/60 px-3 py-2.5">
              <code className="min-w-0 flex-1 break-all font-mono text-[13px]">
                {secret}
              </code>
              <CopyButton value={secret} label="Copy API key" />
            </div>
            <div
              className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[13px]"
              role="alert"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-warning"
                aria-hidden
              />
              <p>
                This is the only time you&apos;ll see this key. We store a hash,
                not the key.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Keys authenticate your agent&apos;s MCP connection to Nebula.
                Claude.ai connectors also create a key here automatically when
                you authorize.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g. Claude Desktop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Expiration</Label>
                <Select value={expiration} onValueChange={setExpiration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRATIONS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={() => void generate()} disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Generate key
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeysCard() {
  const { selectedAgent, selectedAgentId } = useAgentScope();
  const { data: keys, loading, setData } = useLoad(
    () => api.getApiKeys(),
    [selectedAgentId],
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const revoke = async (key: ApiKey) => {
    const previous = keys ?? [];
    setData(previous.filter((k) => k.id !== key.id));
    try {
      await api.revokeApiKey(key.id);
      toast.success(`Revoked "${key.name}"`);
    } catch {
      setData(previous);
      toast.error("Couldn't revoke the key", {
        action: { label: "Retry", onClick: () => void revoke(key) },
      });
    }
  };

  const agentKeys = (keys ?? []).filter((k) => k.kind !== "unscoped");
  const orphanKeys = (keys ?? []).filter((k) => k.kind === "unscoped");

  return (
    <div className="space-y-4">
      {orphanKeys.length > 0 ? (
        <Card
          className={cn(
            "overflow-hidden border-warning/40",
            "bg-warning/[0.04]",
          )}
        >
          <div className="flex items-start gap-2.5 border-b border-warning/30 px-5 py-4">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-warning"
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium">
                Unscoped account keys ({orphanKeys.length})
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                These are not tied to an agent (usually an old Claude.ai OAuth
                connect). They operate your login / EOA wallet. Revoke them, then
                reconnect Claude and pick an agent.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {orphanKeys.map((key) => (
              <KeyRow
                key={key.id}
                keyRow={key}
                onRevoke={setRevokeTarget}
              />
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="min-w-0 truncate text-[13px] text-muted-foreground">
            {selectedAgent
              ? `Keys for ${selectedAgent.name} — Claude.ai connectors and manual keys`
              : "Select an agent to manage its keys"}
          </p>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={!selectedAgentId}
          >
            Create key
          </Button>
        </div>
        {loading || !keys ? (
          <TableSkeleton rows={3} cols={4} className="p-5" />
        ) : agentKeys.length === 0 ? (
          <EmptyState
            title="No keys for this agent yet"
            subtitle={
              selectedAgent
                ? `Mint a key for ${selectedAgent.name}, or connect Claude.ai and pick this agent on the authorize screen — that creates a revocable key here automatically.`
                : "Select an agent to mint its first key."
            }
            actionLabel="Create key"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <ul className="divide-y divide-border">
            {agentKeys.map((key) => (
              <KeyRow
                key={key.id}
                keyRow={key}
                onRevoke={setRevokeTarget}
              />
            ))}
          </ul>
        )}

        <CreateKeyDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(key) => setData([key, ...(keys ?? [])])}
        />
        <ConfirmDialog
          open={revokeTarget != null}
          onOpenChange={(open) => !open && setRevokeTarget(null)}
          title={`Revoke "${revokeTarget?.name}"?`}
          description="Anything using this key (including Claude.ai) loses access immediately. This can't be undone."
          confirmLabel="Revoke key"
          destructive
          onConfirm={async () => {
            if (revokeTarget) await revoke(revokeTarget);
          }}
        />
      </Card>
    </div>
  );
}
