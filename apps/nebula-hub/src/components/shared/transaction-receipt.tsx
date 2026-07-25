"use client";

import { ExternalLink } from "lucide-react";

import { AgentAvatar } from "@/components/agent-scope/agent-avatar";
import { CopyButton } from "@/components/shared/copy-button";
import {
  TX_TYPE_META,
  TxStatusBadge,
} from "@/components/shared/status-badges";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, fmtAmount, fmtDateTime, truncMiddle } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";
import type { Transaction } from "@/types/domain";

function stellarExpertBase(network: "testnet" | "mainnet") {
  return network === "mainnet"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";
}

/**
 * Dashed perforation. With notches, the strip masks true half-circle holes
 * out of its own card fill, so the dialog backdrop shows through the cut and
 * a clipped ring draws the border curving around it.
 */
function Perforation({ notches = true }: { notches?: boolean }) {
  if (!notches) {
    return (
      <div className="border-x border-border-strong bg-surface py-1" aria-hidden>
        <div className="mx-6 border-t border-dashed border-border" />
      </div>
    );
  }
  return (
    <div className="relative flex h-5 items-stretch" aria-hidden>
      <div className="receipt-notch-left relative flex-1 border-l border-border-strong bg-surface">
        <span className="absolute -left-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full border border-border-strong" />
      </div>
      <div className="receipt-notch-right relative flex-1 border-r border-border-strong bg-surface">
        <span className="absolute -right-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full border border-border-strong" />
      </div>
      <div className="absolute inset-x-8 top-1/2 border-t border-dashed border-border" />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-right font-mono text-[13px]">{children}</dd>
    </div>
  );
}

export function TransactionReceipt({
  tx,
  agentName,
  agentColor,
  agentAddress,
  open,
  onOpenChange,
}: {
  tx: Transaction | null;
  agentName: string;
  agentColor?: string | null;
  agentAddress?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 rounded-none border-0 bg-transparent p-0 shadow-none">
        {tx ? (
          <ReceiptBody
            tx={tx}
            agentName={agentName}
            agentColor={agentColor}
            agentAddress={agentAddress}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ReceiptBody({
  tx,
  agentName,
  agentColor,
  agentAddress,
}: {
  tx: Transaction;
  agentName: string;
  agentColor?: string | null;
  agentAddress?: string | null;
}) {
  const meta = TX_TYPE_META[tx.type];
  const Icon = meta.icon;
  const isPolicy = tx.type === "policy_change";
  const isOnchain = !tx.hash.startsWith("hub_");
  const outgoing = agentAddress ? tx.from === agentAddress : true;
  const headline = isPolicy ? "Policy update" : outgoing ? "Sent" : "Received";
  const zero = isPolicy || tx.amount === 0;
  const network = useUIStore((s) => s.network);
  const explorer = stellarExpertBase(network);

  return (
    <div className="text-foreground">
      {/* header band */}
      <div className="relative overflow-hidden rounded-t-2xl border border-b-0 border-border-strong bg-surface px-6 pb-7 pt-7 text-center shadow-[var(--card-shadow)]">
        <div className="relative">
          <DialogTitle className="sr-only">
            Receipt · {meta.label} from {agentName}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {headline} {fmtAmount(Math.abs(tx.amount), tx.asset)} on{" "}
            {fmtDateTime(tx.time)}
          </DialogDescription>

          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated py-1 pl-1 pr-3">
            <AgentAvatar name={agentName} color={agentColor} size="sm" />
            <div className="text-left leading-tight">
              <p className="font-mono text-[13px] font-semibold">{agentName}</p>
              <p className="font-mono text-[10px] tracking-[0.08em] text-subtle">
                NEBULA AGENT
              </p>
            </div>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            <Icon className="size-3.5" aria-hidden />
            {headline}
          </p>
          <div className="mt-1 flex items-end justify-center gap-1.5">
            <span
              className={cn(
                "font-mono text-[clamp(2rem,4vw,2.75rem)] font-bold tracking-[-0.03em] tabular-nums",
                !zero && !outgoing && "text-success",
              )}
            >
              {fmtAmount(Math.abs(tx.amount), tx.asset).replace(
                new RegExp(`\\s*${tx.asset}$`),
                "",
              )}
            </span>
            <span className="mb-1 font-mono text-sm text-muted-foreground">
              {tx.asset}
            </span>
          </div>
          <div className="mt-3 flex justify-center">
            <TxStatusBadge status={tx.status} />
          </div>
        </div>
      </div>

      <Perforation />

      {/* itemized body */}
      <dl className="space-y-3 border-x border-border-strong bg-surface px-6 py-5">
        <Row label="Type">
          <span className="inline-flex items-center gap-1.5">
            <Icon className="size-3.5 text-muted-foreground" aria-hidden />
            {meta.label}
          </span>
        </Row>
        <Row label="Date">{fmtDateTime(tx.time)}</Row>
        <Row label="From">
          <span className="inline-flex items-center font-mono">
            {truncMiddle(tx.from, 6, 6)}
            <CopyButton value={tx.from} label="Copy sender address" />
          </span>
        </Row>
        <Row label="To">
          <span className="inline-flex items-center font-mono">
            {truncMiddle(tx.to, 6, 6)}
            <CopyButton value={tx.to} label="Copy recipient address" />
          </span>
        </Row>
        <Row label="Network fee">
          <span className="font-mono tabular-nums">
            {fmtAmount(tx.fee, "XLM")}
          </span>
        </Row>
        <Row label="Memo">
          <span className={cn(!tx.memo && "text-subtle")}>
            {tx.memo ?? "none"}
          </span>
        </Row>
      </dl>

      {tx.operations.length > 0 ? (
        <>
          <Perforation notches={false} />
          <div className="border-x border-border-strong bg-surface px-6 py-5">
            <p className="mb-2.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              Operations
            </p>
            <ul className="space-y-1.5">
              {tx.operations.map((op, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-border bg-elevated/50 px-3 py-2 text-[12px]"
                >
                  <span className="font-mono text-warm">{op.type}</span>
                  <span className="ml-2 break-all text-muted-foreground">
                    {op.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <Perforation notches={false} />

      {/* footer — hash + explorer */}
      <div className="rounded-b-2xl border border-t-0 border-border-strong bg-surface px-6 pb-6 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              Transaction hash
            </p>
            <div className="flex items-center font-mono text-[13px]">
              <span className="truncate">{truncMiddle(tx.hash, 6, 6)}</span>
              <CopyButton value={tx.hash} label="Copy transaction hash" />
            </div>
          </div>
          {isOnchain ? (
            <a
              href={`${explorer}/tx/${tx.hash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-elevated/50 px-3 py-2 font-mono text-[12px] font-medium transition-colors hover:bg-elevated"
            >
              Stellar Expert
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : (
            <span className="shrink-0 rounded-lg border border-border bg-elevated/50 px-3 py-2 text-[12px] text-muted-foreground">
              Off-chain
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
