"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2, Plus } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SectionRule } from "@/components/design/primitives";
import * as api from "@/lib/api";
import { truncMiddle, cn } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import type { PolicyCategory, PolicyEntry } from "@/types/domain";

const FIELD =
  "box-border h-10 w-full rounded-xl border border-border bg-[var(--panel-3)] px-3.5 text-[13px] text-foreground outline-none transition-[border-color] placeholder:text-muted-foreground focus:border-border-strong";

function PendingOnChain() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
      <Loader2 className="size-3 animate-spin" aria-hidden />
      Saving…
    </span>
  );
}

function policyToast(message: string, txHash: string) {
  const onChain = Boolean(txHash) && !txHash.startsWith("hub");
  toast.success(message, {
    id: `policy-${txHash}`,
    description: onChain
      ? `On-chain · tx ${truncMiddle(txHash, 6, 6)}`
      : "Enforced before this agent signs anything.",
  });
}

function fmtCap(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

function EditPill({
  label,
  accent,
  onClick,
  disabled,
}: {
  label: "EDIT" | "SAVE";
  accent?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-[5px] font-mono text-[10px] tracking-[0.12em] disabled:opacity-50",
        accent
          ? "border-[color-mix(in_srgb,var(--primary)_55%,var(--border-strong))] text-foreground"
          : "border-border-strong text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

/** Hard-cap card — reading shows value; editing uses SAVE + full-width input. */
function CapCard({
  label,
  value,
  hint,
  meter,
  onSave,
}: {
  label: string;
  value: number;
  hint: string;
  meter?: { used: number; total: number };
  onSave: (next: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [pending, setPending] = useState(false);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!pending && !editing) setDisplay(value);
  }, [value, pending, editing]);

  const save = async () => {
    const parsed = Number.parseFloat(draft.replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter an amount above zero");
      return;
    }
    const previous = display;
    setEditing(false);
    setDisplay(parsed);
    setPending(true);
    try {
      await onSave(parsed);
    } catch {
      setDisplay(previous);
    } finally {
      setPending(false);
    }
  };

  const pct = meter
    ? Math.min(100, (meter.used / Math.max(meter.total, 1)) * 100)
    : 0;

  return (
    <div className="rounded-[14px] border border-border bg-elevated p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {pending ? (
          <PendingOnChain />
        ) : editing ? (
          <EditPill label="SAVE" accent onClick={() => void save()} />
        ) : (
          <EditPill
            label="EDIT"
            onClick={() => {
              setDraft(String(display));
              setEditing(true);
            }}
          />
        )}
      </div>

      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          type="text"
          inputMode="decimal"
          autoFocus
          aria-label={`${label} in USDC`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className="mt-2.5 w-full rounded-xl border border-primary bg-[var(--panel-3)] px-3 py-2.5 font-mono text-[24px] tabular-nums outline-none"
        />
      ) : (
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="font-mono text-[28px] leading-none tabular-nums">
            {fmtCap(display)}
          </span>
          <span className="font-mono text-[11px] text-subtle">USDC</span>
        </div>
      )}

      {meter ? (
        <div className="mt-3">
          <div className="h-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${editing ? Math.min(100, (meter.used / Math.max(Number.parseFloat(draft) || meter.total, 1)) * 100) : pct}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] tracking-[0.08em] text-subtle uppercase">
            {fmtCap(meter.used)} / {fmtCap(editing ? Number.parseFloat(draft) || display : display)} USED TODAY
          </p>
        </div>
      ) : (
        <p className="mt-2 font-mono text-[10px] tracking-[0.08em] text-subtle uppercase">
          {hint}
        </p>
      )}
    </div>
  );
}

const CATEGORY_META: Record<PolicyCategory, { label: string }> = {
  x402: { label: "x402 payments" },
  mpp: { label: "MPP payments" },
  transfer: { label: "Transfers" },
};

function CategoryRow({
  name,
  cap,
  used,
  onSave,
}: {
  name: string;
  cap: number;
  used: number;
  onSave: (next: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(cap));
  const [pending, setPending] = useState(false);
  const [display, setDisplay] = useState(cap);

  useEffect(() => {
    if (!pending && !editing) setDisplay(cap);
  }, [cap, pending, editing]);

  const save = async () => {
    const parsed = Number.parseFloat(draft.replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter an amount above zero");
      return;
    }
    const previous = display;
    setEditing(false);
    setDisplay(parsed);
    setPending(true);
    try {
      await onSave(parsed);
    } catch {
      setDisplay(previous);
    } finally {
      setPending(false);
    }
  };

  const shownCap = editing
    ? Number.parseFloat(draft.replace(/,/g, "")) || display
    : display;
  const pct = Math.min(100, (used / Math.max(shownCap, 1)) * 100);
  const unused = used <= 0;

  return (
    <div className="border-b border-border py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[14px]">{name}</p>
        <div className="flex shrink-0 items-center gap-3">
          {editing ? (
            <span className="flex items-center gap-2 font-mono text-[12px]">
              <span className="text-subtle tabular-nums">{fmtCap(used)} /</span>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                type="text"
                inputMode="decimal"
                autoFocus
                aria-label={`${name} cap`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void save();
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
                className="w-24 rounded-[10px] border border-primary bg-[var(--panel-3)] px-2.5 py-1.5 font-mono text-[12px] tabular-nums outline-none"
              />
            </span>
          ) : (
            <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
              {fmtCap(used)} / {fmtCap(display)}
              {unused ? " · unused" : ""}
            </span>
          )}
          {pending ? (
            <PendingOnChain />
          ) : editing ? (
            <EditPill label="SAVE" accent onClick={() => void save()} />
          ) : (
            <EditPill
              label="EDIT"
              onClick={() => {
                setDraft(String(display));
                setEditing(true);
              }}
            />
          )}
        </div>
      </div>
      <div className="mt-2.5 h-[3px] bg-border">
        <div
          className="h-[3px] bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function PolicyPage() {
  const { selectedAgentId, selectedAgent, reloadAgents } = useAgentScope();
  const {
    data: policy,
    setData: setPolicy,
    loading,
    reload: reloadPolicy,
  } = useLoad(() => api.getPolicy(), [selectedAgentId]);
  const { data: wallet } = useLoad(() => api.getWallet(), [selectedAgentId]);

  const [entryAddress, setEntryAddress] = useState("");
  const [entryLabel, setEntryLabel] = useState("");
  const [entryKind, setEntryKind] = useState<"allow" | "deny">("allow");
  const [addingEntry, setAddingEntry] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [pausePending, setPausePending] = useState(false);
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<PolicyEntry | null>(null);
  const [simulateAmount, setSimulateAmount] = useState("");
  const [simulateRail, setSimulateRail] = useState<PolicyCategory>("transfer");

  // Same source of truth as Overview: either flag means spend is blocked.
  const isPaused =
    policy?.paused === true || selectedAgent?.status === "paused";

  const saveDailyCap = async (next: number) => {
    try {
      const { policy: updated, txHash } = await api.updatePolicyLimits({
        dailyCapUSD: next,
      });
      setPolicy((prev) =>
        prev
          ? {
              ...updated,
              contractId: updated.contractId.startsWith("C")
                ? updated.contractId
                : prev.contractId,
              entries: updated.entries.length ? updated.entries : prev.entries,
              categories:
                updated.categories.transfer || updated.categories.x402
                  ? updated.categories
                  : prev.categories,
              paused: prev.paused,
            }
          : updated,
      );
      policyToast("Limits updated", txHash);
    } catch (error) {
      toast.error("Policy update failed", {
        description: error instanceof Error ? error.message : undefined,
        action: { label: "Retry", onClick: () => void saveDailyCap(next) },
      });
      throw error;
    }
  };

  const savePerCallCap = async (next: number) => {
    try {
      const { policy: updated, txHash } = await api.updatePolicyLimits({
        perCallCapXLM: next,
      });
      setPolicy((prev) =>
        prev
          ? {
              ...updated,
              contractId: updated.contractId.startsWith("C")
                ? updated.contractId
                : prev.contractId,
              entries: updated.entries.length ? updated.entries : prev.entries,
              categories:
                updated.categories.transfer || updated.categories.x402
                  ? updated.categories
                  : prev.categories,
              paused: prev.paused,
            }
          : updated,
      );
      if (updated.perCallCapXLM < next) {
        toast.info("Per-tx cap can't exceed the daily cap", {
          description: `Set to ${fmtCap(updated.perCallCapXLM)} USDC to match the daily cap. Raise the daily cap first to go higher.`,
        });
      } else {
        policyToast("Limits updated", txHash);
      }
    } catch (error) {
      toast.error("Policy update failed", {
        description: error instanceof Error ? error.message : undefined,
        action: { label: "Retry", onClick: () => void savePerCallCap(next) },
      });
      throw error;
    }
  };

  const saveCategory = async (category: PolicyCategory, next: number) => {
    try {
      const { policy: updated, txHash } = await api.updateCategoryLimit(
        category,
        next,
      );
      setPolicy(updated);
      policyToast(`${CATEGORY_META[category].label} cap updated`, txHash);
    } catch (error) {
      toast.error("Policy update failed", {
        description: error instanceof Error ? error.message : undefined,
        action: {
          label: "Retry",
          onClick: () => void saveCategory(category, next),
        },
      });
      throw error;
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
      setPolicy(
        policy ? { ...policy, entries: [entry, ...policy.entries] } : policy,
      );
      setEntryAddress("");
      setEntryLabel("");
      policyToast(
        `${entryKind === "allow" ? "Allowlisted" : "Denylisted"} ${truncMiddle(address)}`,
        txHash,
      );
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
      setPolicy(
        policy
          ? { ...policy, entries: policy.entries.filter((e) => e.id !== id) }
          : policy,
      );
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

  const togglePause = async () => {
    if (!policy) return;
    const nextPaused = !isPaused;
    setPausePending(true);
    setPolicy({ ...policy, paused: nextPaused });
    try {
      const { txHash } = await api.setPolicyPaused(nextPaused);
      reloadAgents();
      reloadPolicy();
      policyToast(
        nextPaused ? "All agent activity paused" : "Agent activity resumed",
        txHash,
      );
    } catch {
      setPolicy({ ...policy, paused: !nextPaused });
      toast.error("Couldn't update pause state", {
        action: { label: "Retry", onClick: () => void togglePause() },
      });
    } finally {
      setPausePending(false);
    }
  };

  const revokeAccess = async () => {
    try {
      const { txHash, revokedKeys } = await api.revokeAgentAccess();
      reloadAgents();
      reloadPolicy();
      policyToast(
        revokedKeys > 0
          ? `Revoked ${revokedKeys} API key${revokedKeys === 1 ? "" : "s"}`
          : "Agent taken offline",
        txHash,
      );
    } catch {
      toast.error("Revoke failed", {
        action: { label: "Retry", onClick: () => void revokeAccess() },
      });
    }
  };

  const allowList = policy?.entries.filter((e) => e.kind === "allow") ?? [];
  const denyList = policy?.entries.filter((e) => e.kind === "deny") ?? [];
  const spentToday = wallet?.spendTodayUSD ?? 0;
  const spendByCategory = wallet?.spendTodayByCategory ?? {
    transfer: 0,
    x402: 0,
    mpp: 0,
  };
  const largestToday = wallet?.largestSpendTodayUSD ?? 0;

  const parsedSimulateAmount = Number.parseFloat(simulateAmount);
  const simulateValid =
    Number.isFinite(parsedSimulateAmount) && parsedSimulateAmount > 0;
  const dailyRemaining = policy
    ? Math.max(0, policy.dailyCapUSD - spentToday)
    : 0;
  const categoryCap = policy ? policy.categories[simulateRail] : 0;
  const categoryUsed = spendByCategory[simulateRail] ?? 0;
  const categoryRemaining = Math.max(0, categoryCap - categoryUsed);

  let simulateVerdict: "ALLOWED" | "REJECTED" | null = null;
  let simulateWhy: string | null = null;
  if (simulateValid && policy) {
    if (isPaused) {
      simulateVerdict = "REJECTED";
      simulateWhy =
        "Agent is paused. Every payment rail is blocked until you resume.";
    } else if (parsedSimulateAmount > policy.perCallCapXLM) {
      simulateVerdict = "REJECTED";
      simulateWhy = `Over the ${fmtCap(policy.perCallCapXLM)} USDC per-transaction cap. The agent would get a policy error, not a partial payment.`;
    } else if (parsedSimulateAmount > dailyRemaining) {
      simulateVerdict = "REJECTED";
      simulateWhy = `Over remaining daily budget — ${fmtCap(dailyRemaining)} of ${fmtCap(policy.dailyCapUSD)} USDC left today.`;
    } else if (parsedSimulateAmount > categoryRemaining) {
      simulateVerdict = "REJECTED";
      simulateWhy = `Over the ${CATEGORY_META[simulateRail].label} category cap — ${fmtCap(categoryRemaining)} of ${fmtCap(categoryCap)} USDC left.`;
    } else {
      simulateVerdict = "ALLOWED";
      simulateWhy = `Within per-tx (${fmtCap(policy.perCallCapXLM)}), daily remaining (${fmtCap(dailyRemaining)}), and ${CATEGORY_META[simulateRail].label} (${fmtCap(categoryRemaining)} left).`;
    }
  }

  return (
    <div>
      <div className="mb-8">
        <SectionRule>
          POLICY · {selectedAgent?.name?.toUpperCase() ?? "AGENT"}
        </SectionRule>
        <h1 className="page-title">What this agent may spend</h1>
        <p className="mt-4 max-w-[560px] text-[15px] text-pretty text-muted-foreground">
          These limits live on-chain. The agent cannot raise them, and a payment
          that breaks one never reaches the network.
        </p>
      </div>

      {loading || !policy ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="soft-panel h-[420px] animate-pulse" />
          <div className="soft-panel h-[320px] animate-pulse bg-elevated" />
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* LEFT */}
          <div className="soft-panel" style={{ padding: "30px 32px" }}>
            <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
              HARD CAPS
            </p>
            <div className="mt-[18px] grid grid-cols-1 gap-5 sm:grid-cols-2">
              <CapCard
                label="PER TRANSACTION"
                value={policy.perCallCapXLM}
                hint={
                  largestToday > 0
                    ? `Largest so far ${fmtCap(largestToday)}`
                    : "Largest single payment · USDC"
                }
                onSave={savePerCallCap}
              />
              <CapCard
                label="PER DAY"
                value={policy.dailyCapUSD}
                hint="Resets every 24h · USDC"
                meter={{ used: spentToday, total: policy.dailyCapUSD }}
                onSave={saveDailyCap}
              />
            </div>

            <p className="mt-[34px] font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
              CATEGORY LIMITS
            </p>
            <div>
              {(Object.keys(CATEGORY_META) as PolicyCategory[]).map(
                (category) => (
                  <CategoryRow
                    key={category}
                    name={CATEGORY_META[category].label}
                    cap={policy.categories[category]}
                    used={spendByCategory[category]}
                    onSave={(next) => saveCategory(category, next)}
                  />
                ),
              )}
            </div>

            <div className="mt-[34px] grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                  ALLOWED COUNTERPARTIES
                </p>
                <p className="mt-1 font-mono text-[9px] tracking-[0.08em] text-subtle">
                  THIS AGENT ONLY
                </p>
                {allowList.length === 0 ? (
                  <p className="py-3 font-mono text-[11px] text-subtle">
                    None yet
                  </p>
                ) : (
                  allowList.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      disabled={removingIds.has(entry.id)}
                      onClick={() => setRemoveTarget(entry)}
                      title="Remove from allow list"
                      className="group flex w-full items-center justify-between gap-3 border-b border-border py-2.5 text-left font-mono text-[11px] disabled:opacity-50"
                    >
                      <span className="truncate">
                        {truncMiddle(entry.address, 4, 4)}
                      </span>
                      <span className="shrink-0 text-[10px] tracking-[0.04em] text-subtle uppercase group-hover:text-destructive">
                        {removingIds.has(entry.id)
                          ? "…"
                          : entry.label || "—"}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                  DENIED
                </p>
                <p className="mt-1 font-mono text-[9px] tracking-[0.08em] text-subtle">
                  THIS AGENT ONLY
                </p>
                {denyList.length === 0 ? (
                  <p className="py-3 font-mono text-[11px] text-subtle">
                    None yet
                  </p>
                ) : (
                  denyList.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      disabled={removingIds.has(entry.id)}
                      onClick={() => setRemoveTarget(entry)}
                      title="Remove from deny list"
                      className="group flex w-full items-center justify-between gap-3 border-b border-border py-2.5 text-left font-mono text-[11px] disabled:opacity-50"
                    >
                      <span className="truncate text-destructive">
                        {truncMiddle(entry.address, 4, 4)}
                      </span>
                      <span className="shrink-0 text-[10px] tracking-[0.04em] text-subtle uppercase group-hover:text-destructive">
                        {removingIds.has(entry.id)
                          ? "…"
                          : entry.label || "—"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                ADD COUNTERPARTY
              </p>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addEntry();
                }}
              >
                <div className="min-w-[10rem] flex-1 space-y-1.5">
                  <label
                    htmlFor="entry-address"
                    className="block h-4 font-mono text-[10px] leading-4 tracking-[0.12em] text-muted-foreground"
                  >
                    ADDRESS
                  </label>
                  <input
                    id="entry-address"
                    placeholder="G…"
                    value={entryAddress}
                    onChange={(e) => setEntryAddress(e.target.value)}
                    className={cn(FIELD, "font-mono")}
                  />
                </div>
                <div className="min-w-[8rem] flex-1 space-y-1.5">
                  <label
                    htmlFor="entry-label"
                    className="block h-4 font-mono text-[10px] leading-4 tracking-[0.12em] text-muted-foreground"
                  >
                    NOTE
                  </label>
                  <input
                    id="entry-label"
                    placeholder="e.g. Data vendor"
                    value={entryLabel}
                    onChange={(e) => setEntryLabel(e.target.value)}
                    className={FIELD}
                  />
                </div>
                <div className="w-[6.75rem] shrink-0 space-y-1.5">
                  <label
                    htmlFor="entry-kind"
                    className="block h-4 font-mono text-[10px] leading-4 tracking-[0.12em] text-muted-foreground"
                  >
                    TYPE
                  </label>
                  <div className="relative h-10">
                    <select
                      id="entry-kind"
                      value={entryKind}
                      onChange={(e) =>
                        setEntryKind(e.target.value as "allow" | "deny")
                      }
                      aria-label="Entry type"
                      className={cn(
                        FIELD,
                        "absolute inset-0 cursor-pointer appearance-none pr-8",
                      )}
                    >
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute top-1/2 right-3 z-10 size-3.5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={addingEntry}
                  aria-label="Add counterparty"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
                  style={{
                    background: "var(--btn-bg)",
                    color: "var(--btn-fg)",
                  }}
                >
                  {addingEntry ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="size-4" strokeWidth={2.5} aria-hidden />
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT */}
          <div
            className="soft-panel flex flex-col bg-elevated"
            style={{ padding: "30px 28px" }}
          >
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
              SIMULATE A PAYMENT
            </p>
            <p className="mt-2.5 mb-4 text-[12px] text-muted-foreground">
              Check a payment against this agent&apos;s live caps before it
              tries one.
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(Object.keys(CATEGORY_META) as PolicyCategory[]).map((rail) => {
                const on = simulateRail === rail;
                return (
                  <button
                    key={rail}
                    type="button"
                    onClick={() => setSimulateRail(rail)}
                    className={cn(
                      "rounded-[10px] border px-2.5 py-1.5 font-mono text-[10px] tracking-[0.08em]",
                      on
                        ? "border-transparent"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                    style={
                      on
                        ? {
                            background: "var(--btn-bg)",
                            color: "var(--btn-fg)",
                          }
                        : undefined
                    }
                  >
                    {CATEGORY_META[rail].label.toUpperCase()}
                  </button>
                );
              })}
            </div>
            {policy ? (
              <p className="mb-3 font-mono text-[10px] tracking-[0.06em] text-subtle">
                LIVE · PER TX {fmtCap(policy.perCallCapXLM)} · DAILY LEFT{" "}
                {fmtCap(Math.max(0, policy.dailyCapUSD - spentToday))} ·{" "}
                {CATEGORY_META[simulateRail].label.toUpperCase()} LEFT{" "}
                {fmtCap(
                  Math.max(
                    0,
                    policy.categories[simulateRail] -
                      (spendByCategory[simulateRail] ?? 0),
                  ),
                )}
              </p>
            ) : null}
            <input
              id="simulate-amount"
              type="text"
              inputMode="decimal"
              value={simulateAmount}
              onChange={(e) => setSimulateAmount(e.target.value)}
              className="w-full rounded-xl border border-border bg-[var(--panel-3)] px-3 py-3 font-mono text-[20px] tabular-nums outline-none focus:border-border-strong"
              placeholder="0.00"
            />
            <div
              className={cn(
                "mt-3.5 border p-3.5",
                simulateVerdict === "REJECTED"
                  ? "border-destructive/50 bg-destructive/5"
                  : simulateVerdict === "ALLOWED"
                    ? "border-success/40 bg-success/5"
                    : "border-border",
              )}
            >
              {simulateVerdict ? (
                <>
                  <p
                    className={cn(
                      "font-mono text-[11px] tracking-[0.14em]",
                      simulateVerdict === "ALLOWED"
                        ? "text-success"
                        : "text-destructive",
                    )}
                  >
                    {simulateVerdict}
                  </p>
                  <p className="mt-2 text-[12px] text-pretty text-muted-foreground">
                    {simulateWhy}
                  </p>
                </>
              ) : (
                <p className="text-[12px] text-muted-foreground">
                  Enter an amount to see verdict
                </p>
              )}
            </div>

            <div className="mt-[30px] border-t border-border pt-[22px]">
              <p className="font-mono text-[10px] tracking-[0.16em] text-destructive">
                EMERGENCY
              </p>
              <button
                type="button"
                disabled={pausePending}
                onClick={() => setPauseConfirmOpen(true)}
                className="mt-3.5 w-full rounded-full border border-border-strong py-[11px] text-[13px] disabled:opacity-50"
              >
                {pausePending ? (
                  <Loader2 className="mr-2 inline size-4 animate-spin" />
                ) : null}
                {isPaused ? "Resume agent" : "Pause agent"}
              </button>
              <p className="mt-2.5 mb-[18px] text-[12px] text-muted-foreground">
                {isPaused
                  ? "Payments, swaps, and treasury moves are blocked until you resume. Funds stay in the agent wallet."
                  : "Blocks every payment rail for this agent immediately. Funds stay put; nothing is lost."}
              </p>
              <button
                type="button"
                onClick={() => setRevokeOpen(true)}
                className="w-full rounded-full border border-destructive py-[11px] text-[13px] text-destructive"
              >
                Revoke all API keys
              </button>
              <p className="mt-2.5 text-[12px] text-subtle">
                Invalidates every MCP/API key for this agent and takes it
                offline. Funds stay in the wallet — this does not sweep them.
              </p>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={removeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={
          removeTarget?.kind === "deny"
            ? "Remove from deny list?"
            : "Remove from allow list?"
        }
        description={
          removeTarget
            ? `${truncMiddle(removeTarget.address, 6, 6)}${
                removeTarget.label ? ` · ${removeTarget.label}` : ""
              } will be removed from this agent's ${
                removeTarget.kind === "deny" ? "deny" : "allow"
              } list.`
            : ""
        }
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!removeTarget) return;
          await removeEntry(removeTarget.id);
          setRemoveTarget(null);
        }}
      />

      <ConfirmDialog
        open={pauseConfirmOpen}
        onOpenChange={setPauseConfirmOpen}
        title={isPaused ? "Resume this agent?" : "Pause this agent?"}
        description={
          isPaused
            ? "Payments, swaps, and treasury moves will be allowed again under the current caps."
            : "Every payment rail for this agent will be blocked immediately. Funds stay in the wallet — nothing is lost."
        }
        confirmLabel={isPaused ? "Resume agent" : "Pause agent"}
        onConfirm={togglePause}
      />

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke all API keys for this agent?"
        description="Every MCP/API key tied to this agent stops working immediately, and the agent goes offline. Funds stay in the agent wallet — nothing is swept."
        confirmLabel="Revoke all keys"
        destructive
        typeToConfirm="REVOKE"
        onConfirm={revokeAccess}
      />
    </div>
  );
}
