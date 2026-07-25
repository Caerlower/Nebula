"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, Receipt } from "lucide-react";

import { SectionRule } from "@/components/design/primitives";
import { EmptyState } from "@/components/shared/empty-state";
import { TransactionReceipt } from "@/components/shared/transaction-receipt";
import * as api from "@/lib/api";
import { fmtAmount, truncMiddle, cn } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { useUIStore } from "@/stores/ui";
import type { Transaction, TxStatus, TxType } from "@/types/domain";

type FilterType =
  | "ALL"
  | "TRANSFER"
  | "SWAP"
  | "X402"
  | "MPP"
  | "POLICY CHANGE";

const FILTERS: FilterType[] = [
  "ALL",
  "TRANSFER",
  "SWAP",
  "X402",
  "MPP",
  "POLICY CHANGE",
];

/** TIMESTAMP | RAIL | COUNTERPARTY | AMOUNT | POLICY | STATUS | RECEIPT */
const GRID_COLS = "118px 110px minmax(0,1fr) 140px 120px 88px 72px";

function matchesFilter(tx: Transaction, filter: FilterType): boolean {
  if (filter === "ALL") return true;
  if (filter === "TRANSFER") return tx.type === "transfer";
  if (filter === "SWAP")
    return (
      tx.type === "swap" ||
      tx.type === "blend_deposit" ||
      tx.type === "blend_withdraw"
    );
  if (filter === "X402") return tx.type === "x402";
  if (filter === "MPP") return tx.type === "mpp";
  if (filter === "POLICY CHANGE") return tx.type === "policy_change";
  return true;
}

function railLabel(type: TxType): string {
  switch (type) {
    case "x402":
      return "X402";
    case "mpp":
      return "MPP";
    case "transfer":
      return "TRANSFER";
    case "swap":
      return "SWAP";
    case "blend_deposit":
    case "blend_withdraw":
      return "YIELD";
    case "policy_change":
      return "POLICY CHANGE";
  }
}

function railColor(type: TxType): string {
  switch (type) {
    case "x402":
    case "mpp":
      return "text-primary";
    case "transfer":
      return "text-primary-2";
    case "blend_deposit":
    case "blend_withdraw":
    case "swap":
      return "text-success";
    case "policy_change":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}

function formatTimestamp(isoTime: string) {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
  return `${time} ${dateStr}`;
}

function policyText(status: TxStatus) {
  if (status === "confirmed") return "WITHIN CAPS";
  if (status === "pending") return "COMMITTED";
  if (status === "failed") return "REJECTED";
  return "—";
}

function statusText(status: TxStatus) {
  if (status === "confirmed") return "SETTLED";
  if (status === "pending") return "OPEN";
  if (status === "failed") return "REJECTED";
  return "—";
}

function TxRow({
  tx,
  last,
  onReceipt,
}: {
  tx: Transaction;
  last: boolean;
  onReceipt: () => void;
}) {
  return (
    <div
      className={cn(
        "grid h-[52px] items-center gap-4 px-5 font-mono text-[11px]",
        !last && "border-b border-border",
      )}
      style={{ gridTemplateColumns: GRID_COLS }}
    >
      <span className="truncate text-subtle">{formatTimestamp(tx.time)}</span>
      <span
        className={cn(
          "truncate text-[10px] tracking-[0.1em]",
          railColor(tx.type),
        )}
      >
        {railLabel(tx.type)}
      </span>
      <div className="min-w-0">
        <p className="truncate">{truncMiddle(tx.to, 4, 4)}</p>
        {tx.memo ? (
          <p className="truncate text-[10px] text-subtle">{tx.memo}</p>
        ) : null}
      </div>
      <span className="text-right text-[13px] tabular-nums">
        {fmtAmount(Math.abs(tx.amount), tx.asset)}
      </span>
      <span
        className={cn(
          "text-[10px] tracking-[0.08em]",
          tx.status === "failed" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {policyText(tx.status)}
      </span>
      <span className="text-right text-[9px] tracking-[0.12em] text-subtle">
        {statusText(tx.status)}
      </span>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onReceipt}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[9px] tracking-[0.1em] text-muted-foreground hover:border-border-strong hover:text-foreground"
          aria-label={`Open receipt for ${truncMiddle(tx.hash)}`}
        >
          <Receipt className="size-3" aria-hidden />
          RECEIPT
        </button>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("ALL");
  const [selected, setSelected] = useState<Transaction | null>(null);

  const { selectedAgentId, selectedAgent } = useAgentScope();
  const network = useUIStore((s) => s.network);

  const { data: allTxs } = useLoad(
    () => api.getTransactions({}),
    [selectedAgentId],
  );

  const txs = useMemo(() => {
    if (!allTxs) return [];
    return allTxs.filter((tx) => matchesFilter(tx, selectedFilter));
  }, [allTxs, selectedFilter]);

  const exportCsv = () => {
    const header = "time,type,from,to,amount,asset,status,hash";
    const body = txs.map((tx) =>
      [
        tx.time,
        tx.type,
        tx.from,
        tx.to,
        tx.amount,
        tx.asset,
        tx.status,
        tx.hash,
      ].join(","),
    );
    const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nebula-${selectedAgent?.name ?? "agent"}-transactions-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const explorerUrl = (() => {
    if (!selectedAgent?.address || selectedAgent.address === "—") return "";
    const segment = network === "mainnet" ? "public" : "testnet";
    return `https://stellar.expert/explorer/${segment}/account/${selectedAgent.address}`;
  })();

  return (
    <div>
      <div className="flex items-end justify-between gap-4 pb-6">
        <div>
          <SectionRule>
            ACTIVITY · {selectedAgent?.name?.toUpperCase() ?? "AGENT"}
          </SectionRule>
          <h1 className="page-title">{txs.length} payments</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 pb-1">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!txs.length}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-[18px] py-2 text-[12px] text-muted-foreground disabled:opacity-50"
          >
            <Download className="size-3.5" aria-hidden />
            Export CSV
          </button>
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-[18px] py-2 text-[12px] text-muted-foreground"
            >
              Stellar Explorer
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      <div className="soft-panel-lg overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-border bg-elevated px-5 py-3.5">
          {FILTERS.map((filterType) => {
            const on = selectedFilter === filterType;
            return (
              <button
                key={filterType}
                type="button"
                onClick={() => setSelectedFilter(filterType)}
                className={cn(
                  "rounded-[10px] border px-[13px] py-[7px] font-mono text-[10px] tracking-[0.1em] transition-colors",
                  on
                    ? "border-transparent"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                )}
                style={
                  on
                    ? { background: "var(--btn-bg)", color: "var(--btn-fg)" }
                    : undefined
                }
              >
                {filterType}
              </button>
            );
          })}
          <div className="flex-1" />
          <span className="font-mono text-[10px] tracking-[0.1em] text-subtle">
            {txs.length} OF {allTxs?.length ?? 0} ROWS
          </span>
        </div>

        {allTxs && txs.length === 0 ? (
          <EmptyState
            title="No transactions found"
            subtitle="Once your agent starts making payments, activity will appear here."
          />
        ) : txs.length > 0 ? (
          <>
            <div
              className="hidden gap-4 border-b border-border px-5 py-2.5 font-mono text-[9px] tracking-[0.16em] text-subtle sm:grid"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <span>TIMESTAMP</span>
              <span>RAIL</span>
              <span>COUNTERPARTY</span>
              <span className="text-right">AMOUNT</span>
              <span>POLICY</span>
              <span className="text-right">STATUS</span>
              <span className="text-right"> </span>
            </div>

            <div className="hidden max-h-[560px] overflow-y-auto sm:block">
              {txs.map((tx, i) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  last={i === txs.length - 1}
                  onReceipt={() => setSelected(tx)}
                />
              ))}
            </div>

            <ul className="divide-y divide-border sm:hidden">
              {txs.slice(0, 40).map((tx) => (
                <li key={tx.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "font-mono text-[11px] tracking-[0.1em]",
                        railColor(tx.type),
                      )}
                    >
                      {railLabel(tx.type)}
                    </span>
                    <span className="font-mono text-[13px] tabular-nums">
                      {fmtAmount(Math.abs(tx.amount), tx.asset)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                    <span>{formatTimestamp(tx.time)}</span>
                    <span>{statusText(tx.status)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(tx)}
                    className="mt-2.5 inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] text-muted-foreground"
                  >
                    <Receipt className="size-3" aria-hidden />
                    RECEIPT
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <TransactionReceipt
        tx={selected}
        agentName={selectedAgent?.name ?? "Agent"}
        agentColor={selectedAgent?.avatarColor}
        agentAddress={selectedAgent?.address}
        open={selected != null}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
