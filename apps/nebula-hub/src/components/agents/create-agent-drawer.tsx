"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { SplitBar } from "@/components/design/primitives";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";
import type { Framework } from "@/types/domain";

const FIELD =
  "box-border h-11 w-full border border-border-strong bg-[var(--panel-2)] px-3.5 font-mono text-[15px] text-foreground outline-none transition-[border-color] placeholder:text-subtle focus:border-primary/50";

const NETWORK_LABEL =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet") === "mainnet"
    ? "STELLAR MAINNET"
    : "STELLAR TESTNET";

function slugifyName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function frameworkFromModel(model: string): Framework {
  const m = model.toLowerCase();
  if (m.includes("gpt") || m.includes("openai")) return "openai-sdk";
  if (m.includes("code") && m.includes("claude")) return "claude-code";
  if (
    m.includes("claude") ||
    m.includes("sonnet") ||
    m.includes("haiku") ||
    m.includes("opus")
  ) {
    return "claude-desktop";
  }
  return "custom-mcp";
}

function parseUsd(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/,/g, "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function fmtUsdc(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type WizardState = {
  name: string;
  model: string;
  funding: string;
  liquidFloor: string;
  autoYield: boolean;
  perTx: string;
  daily: string;
};

const DEFAULTS: WizardState = {
  name: "",
  model: "claude-sonnet-4-6",
  funding: "0",
  liquidFloor: "0",
  autoYield: true,
  perTx: "250",
  daily: "1000",
};

function WizardField({
  label,
  hint,
  children,
  accent,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="border-t border-border py-3.5 first:border-t-0 first:pt-0">
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className={cn("mt-2.5", accent && "text-primary-2")}>{children}</div>
      <p className="mt-2 font-mono text-[10px] text-subtle">{hint}</p>
    </div>
  );
}

function CreateAgentWizard({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { reloadAgents, setSelectedAgentId } = useAgentScope();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<WizardState>(DEFAULTS);

  const patch = (p: Partial<WizardState>) =>
    setForm((prev) => ({ ...prev, ...p }));

  const fundingN = parseUsd(form.funding) ?? 0;
  const floorN = parseUsd(form.liquidFloor) ?? 0;
  const perTxN = parseUsd(form.perTx);
  const dailyN = parseUsd(form.daily);

  const previewName = form.name.trim() || "pricing-scout";
  const liquidPct =
    fundingN > 0
      ? Math.min(100, Math.round((Math.min(floorN, fundingN) / fundingN) * 100))
      : 40;
  const yieldPct = form.autoYield ? Math.max(0, 100 - liquidPct) : 0;

  const stepMeta = useMemo(
    () =>
      [
        {
          title: "Name it and pick a model",
          body: "The name shows on every payment this agent makes. Counterparties see it.",
          cta: "Set the band",
        },
        {
          title: "Set the spending band",
          body: "Fund it now or later. The liquid floor is what stays spendable; anything above it earns yield.",
          cta: "Set the limits",
        },
        {
          title: "Set the limits it can't bypass",
          body: "Written to the policy contract at creation. You can change them later; the agent never can.",
          cta: "Create agent",
        },
      ] as const,
    [],
  );
  const meta = stepMeta[step - 1]!;

  const goNext = async () => {
    if (step === 1) {
      const slug = slugifyName(form.name);
      if (!slug) {
        toast.error("Give your agent a name");
        return;
      }
      if (!form.model.trim()) {
        toast.error("Pick a model for attribution");
        return;
      }
      patch({ name: slug });
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    await create();
  };

  const create = async () => {
    const slug = slugifyName(form.name);
    if (!slug) {
      toast.error("Give your agent a name");
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const result = await api.createAgent({
        name: slug,
        framework: frameworkFromModel(form.model),
        description: form.model.trim(),
        perTxCapUSD: perTxN != null && perTxN > 0 ? perTxN : null,
        dailyCapUSD: dailyN != null && dailyN > 0 ? dailyN : null,
      });
      setSelectedAgentId(result.agent.id);
      reloadAgents();
      onClose();
      toast.success(`${slug} created`, {
        description: "Issue an API key on Connect to wire up your client.",
      });
      if (fundingN > 0) {
        toast.message("Fund this agent from Treasury", {
          description: `Transfer ${fmtUsdc(fundingN)} USDC to its wallet when you're ready.`,
        });
      }
      router.push("/connect");
    } catch {
      toast.error("Couldn't create the agent", {
        description: "Please try again.",
      });
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-y-auto px-8 py-8 sm:px-[34px] sm:py-[34px]">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
            NEW AGENT · STEP {step} OF 3
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] tracking-[0.06em] text-subtle hover:text-muted-foreground"
          >
            CLOSE ✕
          </button>
        </div>

        <h2 className="mt-[22px] text-[clamp(1.75rem,4vw,2.125rem)] font-semibold leading-[1.18] tracking-[-0.01em]">
          {meta.title}
        </h2>
        <p className="mt-3.5 max-w-[460px] text-[14px] text-pretty text-muted-foreground">
          {meta.body}
        </p>

        <div className="mt-6">
          {step === 1 ? (
            <>
              <WizardField
                label="AGENT NAME"
                hint="LOWERCASE, HYPHENS — SHOWS ON-CHAIN"
              >
                <input
                  className={FIELD}
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  onBlur={() => {
                    const slug = slugifyName(form.name);
                    if (slug) patch({ name: slug });
                  }}
                  placeholder="pricing-scout"
                  autoFocus
                  maxLength={40}
                  autoComplete="off"
                />
              </WizardField>
              <WizardField
                label="MODEL"
                hint="SHOWN ON FLEET & OVERVIEW — NOT THE MCP CLIENT"
              >
                <input
                  className={FIELD}
                  value={form.model}
                  onChange={(e) => patch({ model: e.target.value })}
                  placeholder="claude-sonnet-4-6"
                  maxLength={64}
                  autoComplete="off"
                />
              </WizardField>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <WizardField
                label="INITIAL FUNDING"
                hint="FROM YOUR ACCOUNT WALLET — FUND AFTER CREATE"
              >
                <div className="relative">
                  <input
                    className={cn(FIELD, "pr-16")}
                    value={form.funding}
                    onChange={(e) => patch({ funding: e.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-mono text-[12px] text-subtle">
                    USDC
                  </span>
                </div>
              </WizardField>
              <WizardField label="LIQUID FLOOR" hint="KEPT OUT OF BLEND">
                <div className="relative">
                  <input
                    className={cn(FIELD, "pr-16")}
                    value={form.liquidFloor}
                    onChange={(e) => patch({ liquidFloor: e.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-mono text-[12px] text-subtle">
                    USDC
                  </span>
                </div>
              </WizardField>
              <WizardField
                label="AUTO-YIELD"
                hint="CAN BE TURNED OFF ANY TIME"
                accent={form.autoYield}
              >
                <button
                  type="button"
                  onClick={() => patch({ autoYield: !form.autoYield })}
                  className={cn(
                    FIELD,
                    "flex items-center text-left",
                    form.autoYield ? "text-primary-2" : "text-muted-foreground",
                  )}
                >
                  {form.autoYield
                    ? "ON · BLEND USDC POOL"
                    : "OFF · KEEP FULLY LIQUID"}
                </button>
              </WizardField>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <WizardField label="PER TRANSACTION" hint="REJECTED ABOVE THIS">
                <div className="relative">
                  <input
                    className={cn(FIELD, "pr-16")}
                    value={form.perTx}
                    onChange={(e) => patch({ perTx: e.target.value })}
                    inputMode="decimal"
                    placeholder="250.00"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-mono text-[12px] text-subtle">
                    USDC
                  </span>
                </div>
              </WizardField>
              <WizardField label="PER DAY" hint="RESETS 00:00 UTC">
                <div className="relative">
                  <input
                    className={cn(FIELD, "pr-16")}
                    value={form.daily}
                    onChange={(e) => patch({ daily: e.target.value })}
                    inputMode="decimal"
                    placeholder="1000.00"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-mono text-[12px] text-subtle">
                    USDC
                  </span>
                </div>
              </WizardField>
              <WizardField
                label="COUNTERPARTIES"
                hint="OPEN BY DEFAULT — DENY OR ALLOW ON POLICY"
              >
                <div
                  className={cn(FIELD, "flex items-center text-muted-foreground")}
                >
                  ALLOW / DENY · CONFIGURE AFTER CREATE
                </div>
              </WizardField>
            </>
          ) : null}
        </div>

        <div className="mt-7 flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void goNext()}
            className="inline-flex shrink-0 items-center gap-2 rounded-full px-6 py-3 text-[13px] font-semibold disabled:opacity-50"
            style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Provisioning…
              </>
            ) : (
              meta.cta
            )}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (step <= 1) onClose();
              else setStep((s) => Math.max(1, s - 1));
            }}
            className="inline-flex shrink-0 items-center rounded-full border border-border-strong px-5 py-3 text-[13px] text-muted-foreground disabled:opacity-50"
          >
            Back
          </button>
        </div>
      </div>

      <aside className="overflow-y-auto border-t border-border bg-elevated px-6 py-8 sm:px-[26px] sm:py-[34px] lg:border-t-0 lg:border-l">
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
          PREVIEW
        </p>
        <div className="mt-[18px] rounded-[14px] border border-border bg-[var(--panel-2)] p-5">
          <div className="flex items-center gap-2">
            <span className="size-[7px] rounded-full bg-subtle" aria-hidden />
            <span className="font-mono text-[12px]">{previewName}</span>
          </div>
          <p className="mt-4 font-mono text-[26px] tracking-[-0.02em] tabular-nums">
            {fmtUsdc(fundingN)}
          </p>
          <SplitBar
            liquidPct={liquidPct}
            yieldPct={yieldPct}
            height={8}
            className="mt-3.5 border border-border"
          />
          <div className="mt-2.5 flex justify-between font-mono text-[9px] tracking-[0.1em] text-subtle">
            <span>LIQUID</span>
            <span>YIELD</span>
          </div>
        </div>

        {(
          [
            { label: "WALLET", val: "PRIVY CUSTODIAL" },
            { label: "NETWORK", val: NETWORK_LABEL },
            {
              label: "PER-TX CAP",
              val:
                step >= 3 && perTxN != null && perTxN > 0
                  ? fmtUsdc(perTxN)
                  : "NOT SET",
            },
            {
              label: "DAILY CAP",
              val:
                step >= 3 && dailyN != null && dailyN > 0
                  ? fmtUsdc(dailyN)
                  : "NOT SET",
            },
          ] as const
        ).map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between border-b border-border py-3 font-mono text-[11px]"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="tabular-nums">{row.val}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}

/** Right-side create-agent drawer over Fleet (and anywhere else that opens it). */
export function CreateAgentDrawer() {
  const open = useUIStore((s) => s.createAgentOpen);
  const setOpen = useUIStore((s) => s.setCreateAgentOpen);
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (open) setSession((n) => n + 1);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex h-full w-[min(880px,94vw)] max-w-none flex-col gap-0 overflow-hidden border-l border-border-strong bg-background p-0 shadow-[-40px_0_90px_-30px_rgba(0,0,0,0.7)] sm:max-w-[min(880px,94vw)] [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Create an agent</SheetTitle>
        <SheetDescription className="sr-only">
          Three-step wizard to name the agent, set its spending band, and apply
          spend limits.
        </SheetDescription>
        <CreateAgentWizard key={session} onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
