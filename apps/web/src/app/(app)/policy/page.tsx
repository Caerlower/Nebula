"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, Pencil, Trash2, X } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { CopyButton } from "@/components/shared/copy-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusDot } from "@/components/shared/status-badges";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as api from "@/lib/api";
import { fmtDate, fmtUSD, truncMiddle } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import type { PolicyCategory } from "@/mocks/types";

function PendingOnChain() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-warning">
      <StatusDot tone="warning" pulse />
      Pending on-chain…
    </span>
  );
}

function policyToast(message: string, txHash: string) {
  toast.success(message, { description: `tx ${truncMiddle(txHash, 6, 6)}` });
}

/** Click the number → it becomes an input with save/cancel. */
function InlineEditUSD({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (next: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [pending, setPending] = useState(false);

  const save = async () => {
    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter an amount above zero");
      return;
    }
    setEditing(false);
    setPending(true);
    try {
      await onSave(parsed);
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      {editing ? (
        <form
          className="mt-1 flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            type="number"
            min="1"
            step="any"
            className="h-8 w-28 font-mono"
            autoFocus
            aria-label={`${label} in USD`}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Button type="submit" size="icon" variant="ghost" className="size-7" aria-label="Save limit">
            <Check className="size-3.5 text-success" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => setEditing(false)}
            aria-label="Cancel edit"
          >
            <X className="size-3.5" />
          </Button>
        </form>
      ) : (
        <div className="mt-1 flex items-center gap-1.5">
          <button
            type="button"
            className="group inline-flex items-center gap-1.5 rounded font-mono text-xl tabular hover:text-primary"
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
            disabled={pending}
            aria-label={`Edit ${label.toLowerCase()} — currently ${fmtUSD(value)}`}
          >
            {fmtUSD(value)}
            <Pencil className="size-3 text-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
          </button>
          {pending ? <PendingOnChain /> : null}
        </div>
      )}
    </div>
  );
}

const CATEGORY_META: Record<PolicyCategory, { label: string; blurb: string }> = {
  x402: { label: "x402 payments", blurb: "One-shot HTTP 402 payments for API calls and content." },
  mpp: { label: "MPP payments", blurb: "Streaming micropayment channels, settled on close." },
  blend: { label: "Blend deposits", blurb: "Treasury moves into yield pools." },
  transfer: { label: "Transfers", blurb: "Direct XLM/USDC sends to other accounts." },
};

export default function PolicyPage() {
  const { data: policy, setData: setPolicy, loading } = useLoad(() => api.getPolicy(), []);

  const [entryAddress, setEntryAddress] = useState("");
  const [entryLabel, setEntryLabel] = useState("");
  const [entryKind, setEntryKind] = useState<"allow" | "deny">("allow");
  const [addingEntry, setAddingEntry] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [pausePending, setPausePending] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const saveLimit = async (key: "dailyCapUSD" | "weeklyCapUSD" | "monthlyCapUSD", next: number) => {
    try {
      const { policy: updated, txHash } = await api.updatePolicyLimits({ [key]: next });
      setPolicy(updated);
      policyToast("Policy updated", txHash);
    } catch {
      toast.error("Policy update failed", {
        action: { label: "Retry", onClick: () => void saveLimit(key, next) },
      });
    }
  };

  const saveCategory = async (category: PolicyCategory, next: number) => {
    try {
      const { policy: updated, txHash } = await api.updateCategoryLimit(category, next);
      setPolicy(updated);
      policyToast(`${CATEGORY_META[category].label} cap updated`, txHash);
    } catch {
      toast.error("Policy update failed", {
        action: { label: "Retry", onClick: () => void saveCategory(category, next) },
      });
    }
  };

  const addEntry = async () => {
    const address = entryAddress.trim().toUpperCase();
    if (!/^G[A-Z2-7]{10,55}$/.test(address)) {
      toast.error("Enter a valid Stellar address (starts with G)");
      return;
    }
    setAddingEntry(true);
    try {
      const { entry, txHash } = await api.addPolicyEntry({
        address,
        label: entryLabel.trim() || "Untitled",
        kind: entryKind,
      });
      setPolicy(policy ? { ...policy, entries: [entry, ...policy.entries] } : policy);
      setEntryAddress("");
      setEntryLabel("");
      policyToast(`${entryKind === "allow" ? "Allowlisted" : "Denylisted"} ${truncMiddle(address)}`, txHash);
    } catch {
      toast.error("Couldn't add the address", {
        action: { label: "Retry", onClick: () => void addEntry() },
      });
    } finally {
      setAddingEntry(false);
    }
  };

  const removeEntry = async (id: string) => {
    setRemovingIds((prev) => new Set(prev).add(id));
    try {
      const { txHash } = await api.removePolicyEntry(id);
      setPolicy(policy ? { ...policy, entries: policy.entries.filter((e) => e.id !== id) } : policy);
      policyToast("Address removed", txHash);
    } catch {
      toast.error("Couldn't remove the address", {
        action: { label: "Retry", onClick: () => void removeEntry(id) },
      });
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const togglePause = async (paused: boolean) => {
    if (!policy) return;
    setPausePending(true);
    setPolicy({ ...policy, paused });
    try {
      const { txHash } = await api.setPolicyPaused(paused);
      policyToast(paused ? "All agent activity paused" : "Agent activity resumed", txHash);
    } catch {
      setPolicy({ ...policy, paused: !paused });
      toast.error("Couldn't update pause state", {
        action: { label: "Retry", onClick: () => void togglePause(paused) },
      });
    } finally {
      setPausePending(false);
    }
  };

  const revokeAccess = async () => {
    try {
      const { txHash } = await api.revokeAgentAccess();
      policyToast("Agent access revoked", txHash);
    } catch {
      toast.error("Revoke failed", { action: { label: "Retry", onClick: () => void revokeAccess() } });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="wallet"
        title="Spending policy"
        subtitle="Limits live in a Soroban contract on Stellar — agents can't spend around them."
      />

      {loading || !policy ? (
        <Card className="p-5">
          <TableSkeleton rows={4} cols={3} />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* contract id */}
          <Card className="flex flex-wrap items-center gap-2 p-4">
            <span className="text-[13px] text-muted-foreground">Contract</span>
            <code className="min-w-0 truncate font-mono text-sm" title={policy.contractId}>
              {truncMiddle(policy.contractId, 8, 8)}
            </code>
            <CopyButton value={policy.contractId} label="Copy contract ID" />
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${policy.contractId}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              View on Stellar Expert <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Card>

          {/* current limits */}
          <Card className="p-5">
            <p className="text-[13px] font-medium text-muted-foreground">Current limits</p>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <InlineEditUSD
                label="Daily cap"
                value={policy.dailyCapUSD}
                onSave={(v) => saveLimit("dailyCapUSD", v)}
              />
              <InlineEditUSD
                label="Weekly cap"
                value={policy.weeklyCapUSD}
                onSave={(v) => saveLimit("weeklyCapUSD", v)}
              />
              <InlineEditUSD
                label="Monthly cap"
                value={policy.monthlyCapUSD}
                onSave={(v) => saveLimit("monthlyCapUSD", v)}
              />
            </div>
          </Card>

          {/* allowlist / denylist */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <p className="text-[13px] font-medium text-muted-foreground">Allowlist / denylist</p>
            </div>
            <form
              className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                void addEntry();
              }}
            >
              <div className="min-w-52 flex-1 space-y-1.5">
                <Label htmlFor="entry-address" className="text-xs">
                  Destination address
                </Label>
                <Input
                  id="entry-address"
                  placeholder="G…"
                  value={entryAddress}
                  onChange={(e) => setEntryAddress(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="min-w-40 flex-1 space-y-1.5">
                <Label htmlFor="entry-label" className="text-xs">
                  Label
                </Label>
                <Input
                  id="entry-label"
                  placeholder="e.g. Data vendor"
                  value={entryLabel}
                  onChange={(e) => setEntryLabel(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="entry-kind">
                  Type
                </Label>
                <Select value={entryKind} onValueChange={(v) => setEntryKind(v as "allow" | "deny")}>
                  <SelectTrigger id="entry-kind" className="w-28" aria-label="Entry type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Allow</SelectItem>
                    <SelectItem value="deny">Deny</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={addingEntry}>
                {addingEntry ? <Loader2 className="size-4 animate-spin" /> : null}
                {addingEntry ? "Pending on-chain" : "Add address"}
              </Button>
            </form>
            {policy.entries.length === 0 ? (
              <EmptyState
                title="No listed addresses"
                subtitle="Allowlist trusted destinations or block bad actors — enforced by the contract."
              />
            ) : (
              <>
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Address</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="w-12" aria-label="Remove" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policy.entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono text-[13px]">
                            <span className="inline-flex items-center">
                              {truncMiddle(entry.address)}
                              <CopyButton value={entry.address} label="Copy address" className="ml-1" />
                            </span>
                          </TableCell>
                          <TableCell>{entry.label}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-normal",
                                entry.kind === "allow" ? "text-success" : "text-destructive",
                              )}
                            >
                              {entry.kind === "allow" ? "Allow" : "Deny"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{fmtDate(entry.addedAt)}</TableCell>
                          <TableCell>
                            {removingIds.has(entry.id) ? (
                              <PendingOnChain />
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                onClick={() => void removeEntry(entry.id)}
                                aria-label={`Remove ${entry.label}`}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="divide-y divide-border sm:hidden">
                  {policy.entries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{entry.label}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {truncMiddle(entry.address)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal",
                          entry.kind === "allow" ? "text-success" : "text-destructive",
                        )}
                      >
                        {entry.kind}
                      </Badge>
                      {removingIds.has(entry.id) ? (
                        <PendingOnChain />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground"
                          onClick={() => void removeEntry(entry.id)}
                          aria-label={`Remove ${entry.label}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* category limits */}
          <div>
            <p className="mb-3 text-[13px] font-medium text-muted-foreground">Category limits (per day)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(CATEGORY_META) as PolicyCategory[]).map((category) => (
                <Card key={category} className="p-4">
                  <InlineEditUSD
                    label={CATEGORY_META[category].label}
                    value={policy.categories[category]}
                    onSave={(v) => saveCategory(category, v)}
                  />
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {CATEGORY_META[category].blurb}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          {/* emergency controls */}
          <Card className="border-destructive/40 p-5">
            <p className="text-[13px] font-medium text-destructive">Emergency controls</p>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm">Pause all agent activity</p>
                <p className="text-[13px] text-muted-foreground">
                  Freezes every payment path in the contract until resumed.
                </p>
              </div>
              <span className="inline-flex items-center gap-3">
                {pausePending ? <PendingOnChain /> : null}
                <Switch
                  checked={policy.paused}
                  disabled={pausePending}
                  onCheckedChange={(next) => void togglePause(next)}
                  aria-label="Pause all agent activity"
                />
              </span>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-5">
              <div>
                <p className="text-sm">Revoke agent access</p>
                <p className="text-[13px] text-muted-foreground">
                  Invalidates every agent session and takes them offline.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setRevokeOpen(true)}>
                Revoke access
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke all agent access?"
        description="Every connected agent goes offline immediately and will need new keys to reconnect."
        confirmLabel="Revoke access"
        destructive
        typeToConfirm="REVOKE"
        onConfirm={revokeAccess}
      />
    </div>
  );
}
