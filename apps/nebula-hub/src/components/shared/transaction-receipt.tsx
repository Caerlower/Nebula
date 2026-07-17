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
import { cn, fmtDateTime, fmtXLM, truncMiddle } from "@/lib/utils";
import type { Transaction } from "@/types/domain";

const STELLAR_EXPERT = "https://stellar.expert/explorer/testnet";

/** Dashed perforation with clipped side notches — reads as a torn receipt. */
function Perforation({ notches = true }: { notches?: boolean }) {
  return (
    <div className="relative py-1" aria-hidden>
      {notches ? (
        <>
          <span className="absolute -left-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-black/80" />
          <span className="absolute -right-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-black/80" />
        </>
      ) : null}
      <div className="mx-6 border-t border-dashed border-border" />
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
      <dt className="stat-label">{label}</dt>
      <dd className="text-right text-[13px]">{children}</dd>
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
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border-strong bg-card p-0 shadow-[var(--card-shadow)]">
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

  return (
    <div className="text-foreground">
      {/* header band */}
      <div className="relative px-6 pb-7 pt-7 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 60%)",
          }}
        />
        <div className="relative">
          <DialogTitle className="sr-only">
            Receipt · {meta.label} from {agentName}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {headline} {fmtXLM(Math.abs(tx.amount))} {tx.asset} on{" "}
            {fmtDateTime(tx.time)}
          </DialogDescription>

          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 py-1 pl-1 pr-3 backdrop-blur">
            <AgentAvatar name={agentName} color={agentColor} size="sm" />
            <div className="text-left leading-tight">
              <p className="text-[13px] font-semibold">{agentName}</p>
              <p className="text-[11px] text-muted-foreground">Nebula agent</p>
            </div>
          </div>

          <p className="stat-label mt-6 flex items-center justify-center gap-1.5">
            <Icon className="size-3.5" aria-hidden />
            {headline}
          </p>
          <div className="mt-1 flex items-end justify-center gap-1.5">
            <span
              className={cn(
                "hero-number",
                !zero && !outgoing && "text-success",
              )}
            >
              {fmtXLM(Math.abs(tx.amount))}
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
      <dl className="space-y-3 px-6 py-5">
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
          <span className="font-mono tabular">{fmtXLM(tx.fee)} XLM</span>
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
          <div className="px-6 py-5">
            <p className="stat-label mb-2.5">Operations</p>
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
      <div className="px-6 pb-6 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="stat-label">Transaction hash</p>
            <div className="flex items-center font-mono text-[13px]">
              <span className="truncate">{truncMiddle(tx.hash, 6, 6)}</span>
              <CopyButton value={tx.hash} label="Copy transaction hash" />
            </div>
          </div>
          {isOnchain ? (
            <a
              href={`${STELLAR_EXPERT}/tx/${tx.hash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-elevated/50 px-3 py-2 text-[13px] font-medium transition-colors hover:bg-elevated"
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
