"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, TriangleAlert } from "lucide-react";

import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CopyButton } from "@/components/shared/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLoad } from "@/hooks/use-load";
import * as api from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import type { ApiKey } from "@/types/domain";

const FIELD =
  "box-border h-11 w-full border border-border-strong bg-[var(--panel-3)] px-3.5 font-mono text-[14px] text-foreground outline-none transition-[border-color] placeholder:text-subtle focus:border-border-strong";

const EXPIRATIONS = [
  { value: "7", label: "7 DAYS", days: 7 },
  { value: "30", label: "30 DAYS", days: 30 },
  { value: "180", label: "6 MONTHS", days: 180 },
  { value: "never", label: "NEVER", days: null },
] as const;

function keyMeta(key: ApiKey): string {
  const kind =
    key.kind === "oauth"
      ? "CLAUDE.AI"
      : key.kind === "unscoped"
        ? "UNSCOPED"
        : key.name.toUpperCase();
  const used = key.lastUsed
    ? `USED ${timeAgo(key.lastUsed).toUpperCase()}`
    : "NEVER USED";
  return `${kind} · ${used}`;
}

function formatPrefix(prefix: string): string {
  // Already truncated from the API (nbl_live_xxxx…yyyy) or a fresh mint slice.
  if (prefix.includes("…") || prefix.includes("...")) return prefix;
  if (prefix.length >= 16) return `${prefix.slice(0, 12)}…${prefix.slice(-4)}`;
  return `${prefix}…`;
}

function TokenRow({
  keyRow,
  onRevoke,
}: {
  keyRow: ApiKey;
  onRevoke: (key: ApiKey) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border py-3.5 last:border-b-0">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-mono text-[11px]">
          {formatPrefix(keyRow.prefix)}
        </span>
        <span className="font-mono text-[9px] tracking-[0.1em] text-subtle">
          {keyMeta(keyRow)}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onRevoke(keyRow)}
        className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-subtle hover:text-destructive"
      >
        REVOKE
      </button>
    </li>
  );
}

/** Compact token list for Connect sidebar — matches Claude Design TOKENS rail. */
export function AgentTokensPanel() {
  const { selectedAgentId } = useAgentScope();
  const { data: keys, loading, setData } = useLoad(
    () => api.getApiKeys(),
    [selectedAgentId],
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const agentKeys = (keys ?? []).filter((k) => k.kind !== "unscoped");

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
    <div>
      <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
        TOKENS
      </p>

      {loading && !keys ? (
        <div className="mt-2 space-y-0">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse border-b border-border last:border-b-0"
            />
          ))}
        </div>
      ) : agentKeys.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          No tokens yet for this agent.
        </p>
      ) : (
        <ul className="mt-1">
          {agentKeys.map((key) => (
            <TokenRow key={key.id} keyRow={key} onRevoke={setRevokeTarget} />
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={!selectedAgentId}
        onClick={() => setCreateOpen(true)}
        className="mt-4 flex w-full items-center justify-center rounded-full border border-border-strong py-2.5 text-[12px] text-muted-foreground disabled:opacity-50"
      >
        Issue new token
      </button>

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
    </div>
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
      <DialogContent className="max-w-[440px] gap-6">
        {secret ? (
          <>
            <DialogHeader>
              <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                TOKEN ISSUED
              </p>
              <DialogTitle>Copy it now</DialogTitle>
              <DialogDescription>
                This is the only time the full key is shown. Paste it into your
                client on Connect.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-1 border border-border bg-[var(--panel-3)] px-3.5 py-3">
              <code className="min-w-0 flex-1 break-all font-mono text-[13px]">
                {secret}
              </code>
              <CopyButton value={secret} label="Copy API key" />
            </div>
            <div
              className="flex items-start gap-2.5 border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[13px]"
              role="alert"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-warning"
                aria-hidden
              />
              <p>We store a hash, not the key. Lost it? Issue a fresh one.</p>
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-full px-5 py-2.5 text-[13px] font-semibold"
                style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
              >
                Done
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                ISSUE TOKEN
              </p>
              <DialogTitle>Name the key</DialogTitle>
              <DialogDescription>
                Scoped to the selected agent only. Revoke anytime without
                touching the wallet.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                  LABEL
                </p>
                <input
                  className={cn(FIELD, "mt-2.5")}
                  placeholder="claude-desktop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  autoComplete="off"
                />
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                  EXPIRES
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {EXPIRATIONS.map((e) => {
                    const active = e.value === expiration;
                    return (
                      <button
                        key={e.value}
                        type="button"
                        onClick={() => setExpiration(e.value)}
                        className={cn(
                          "rounded-[10px] border px-3.5 py-2 font-mono text-[10px] tracking-[0.1em]",
                          active
                            ? "border-primary bg-[var(--accent-soft)] text-foreground"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {e.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-full border border-border-strong px-5 py-2.5 text-[13px] text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void generate()}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold disabled:opacity-50"
                style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Issue token
              </button>
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
        <div className="soft-panel overflow-hidden border-warning/40 bg-warning/[0.04]">
          <div className="flex items-start gap-2.5 border-b border-warning/30 px-6 py-4">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-warning"
              aria-hidden
            />
            <div>
              <p className="font-mono text-[11px] tracking-[0.08em]">
                UNSCOPED ACCOUNT KEYS · {orphanKeys.length}
              </p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Not tied to an agent — usually an old Claude.ai OAuth connect.
                Revoke, then reconnect and pick an agent.
              </p>
            </div>
          </div>
          <ul className="px-6">
            {orphanKeys.map((key) => (
              <TokenRow
                key={key.id}
                keyRow={key}
                onRevoke={setRevokeTarget}
              />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="soft-panel-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
              TOKENS
            </p>
            <p className="mt-1 truncate text-[13px] text-muted-foreground">
              {selectedAgent
                ? `Scoped to ${selectedAgent.name}`
                : "Select an agent to manage its keys"}
            </p>
          </div>
          <button
            type="button"
            disabled={!selectedAgentId}
            onClick={() => setCreateOpen(true)}
            className="inline-flex shrink-0 rounded-full px-5 py-2.5 text-[13px] font-semibold disabled:opacity-50"
            style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
          >
            Issue new token
          </button>
        </div>

        {loading || !keys ? (
          <div className="space-y-0 px-6 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse border-b border-border last:border-b-0"
              />
            ))}
          </div>
        ) : agentKeys.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-mono text-[13px] text-muted-foreground">
              No tokens for this agent yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-[13px] text-pretty text-subtle">
              Issue a key here, then paste it into your client on Connect.
              Claude.ai OAuth also lands a revocable key in this list.
            </p>
            <button
              type="button"
              disabled={!selectedAgentId}
              onClick={() => setCreateOpen(true)}
              className="mt-6 inline-flex rounded-full border border-border-strong px-5 py-2.5 text-[12px] text-muted-foreground disabled:opacity-50"
            >
              Issue new token
            </button>
          </div>
        ) : (
          <ul className="px-6">
            {agentKeys.map((key) => (
              <TokenRow
                key={key.id}
                keyRow={key}
                onRevoke={setRevokeTarget}
              />
            ))}
          </ul>
        )}
      </div>

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
    </div>
  );
}
