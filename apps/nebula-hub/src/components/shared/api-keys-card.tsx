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
import { fmtDate, timeAgo } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import type { ApiKey } from "@/types/domain";

const EXPIRATIONS = [
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
  { value: "180", label: "6 months", days: 180 },
  { value: "never", label: "Never", days: null },
] as const;

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
              <DialogDescription>Copy it now and store it somewhere safe.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-elevated/60 px-3 py-2.5">
              <code className="min-w-0 flex-1 break-all font-mono text-[13px]">{secret}</code>
              <CopyButton value={secret} label="Copy API key" />
            </div>
            <div
              className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[13px]"
              role="alert"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p>This is the only time you&apos;ll see this key. We store a hash, not the key.</p>
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
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void generate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g. Atlas production"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="key-expiration">Expiration</Label>
                <Select value={expiration} onValueChange={setExpiration}>
                  <SelectTrigger id="key-expiration" aria-label="Key expiration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRATIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </form>
            <DialogFooter>
              <Button variant="ghost" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => void generate()} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
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

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <p className="min-w-0 truncate text-[13px] text-muted-foreground">
          {selectedAgent
            ? `Keys for ${selectedAgent.name} — each operates only this agent's wallet`
            : "Select an agent to manage its keys"}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!selectedAgentId}>
          Create key
        </Button>
      </div>
      {loading || !keys ? (
        <TableSkeleton rows={3} cols={4} className="p-5" />
      ) : keys.length === 0 ? (
        <EmptyState
          title="Create this agent's first key"
          subtitle={
            selectedAgent
              ? `Mint an nbl_live_ token for ${selectedAgent.name}. It authenticates as this agent only and operates only its wallet.`
              : "Select an agent to mint its first key."
          }
          actionLabel="Create key"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <ul className="divide-y divide-border">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm">{key.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{key.prefix}…</p>
              </div>
              <span className="text-xs text-muted-foreground">Created {fmtDate(key.createdAt)}</span>
              <span className="w-28 text-xs text-muted-foreground">
                {key.expiresAt
                  ? `Expires ${fmtDate(key.expiresAt)}`
                  : "Never expires"}
              </span>
              <span className="w-24 text-xs text-muted-foreground">
                {key.lastUsed ? `Used ${timeAgo(key.lastUsed)}` : "Never used"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setRevokeTarget(key)}
                aria-label={`Revoke ${key.name}`}
              >
                Revoke
              </Button>
            </li>
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
        description="Anything using this key loses access immediately. This can't be undone."
        confirmLabel="Revoke key"
        destructive
        onConfirm={async () => {
          if (revokeTarget) await revoke(revokeTarget);
        }}
      />
    </Card>
  );
}
