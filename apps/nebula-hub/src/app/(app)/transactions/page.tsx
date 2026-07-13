"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { FixedSizeList } from "react-window";
import { CalendarIcon, Check, ChevronDown, Download, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { CopyButton } from "@/components/shared/copy-button";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import {
  TX_STATUS_META,
  TX_TYPE_META,
  TxStatusBadge,
  TxTypeLabel,
} from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import * as api from "@/lib/api";
import { fmtAmount, fmtDateTime, truncMiddle } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { cn } from "@/lib/utils";
import type { Transaction, TxStatus, TxType } from "@/types/domain";


const ALL_TYPES = Object.keys(TX_TYPE_META) as TxType[];
const ALL_STATUSES = Object.keys(TX_STATUS_META) as TxStatus[];

function MultiSelect<T extends string>({
  label,
  options,
  selected,
  onToggle,
  renderOption,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (option: T) => void;
  renderOption: (option: T) => string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 font-normal" aria-label={`Filter by ${label}`}>
          {label}
          {selected.length > 0 ? (
            <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
              {selected.length}
            </span>
          ) : null}
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-elevated"
              onClick={() => onToggle(option)}
              aria-pressed={active}
            >
              {renderOption(option)}
              {active ? <Check className="size-3.5 text-primary" aria-hidden /> : null}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

const GRID_COLS = "minmax(120px,1fr) minmax(90px,0.8fr) minmax(130px,1fr) minmax(190px,1.5fr) minmax(120px,1fr) minmax(110px,0.9fr) minmax(120px,0.9fr)";

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [types, setTypes] = useState<TxType[]>([]);
  const [statuses, setStatuses] = useState<TxStatus[]>([]);
  const [range, setRange] = useState<DateRange | undefined>();
  const [selected, setSelected] = useState<Transaction | null>(null);

  const { data: agents } = useLoad(() => api.getAgents(), []);

  const filter: api.TxFilter = useMemo(
    () => ({
      search: search || undefined,
      agentIds: agentIds.length ? agentIds : undefined,
      types: types.length ? types : undefined,
      statuses: statuses.length ? statuses : undefined,
      from: range?.from?.toISOString(),
      to: range?.to ? new Date(range.to.getTime() + 86_399_000).toISOString() : undefined,
    }),
    [search, agentIds, types, statuses, range],
  );

  const { data: txs, loading } = useLoad(
    () => api.getTransactions(filter),
    [search, agentIds, types, statuses, range],
  );

  const agentName = (id: string) => agents?.find((a) => a.id === id)?.name ?? "—";
  const hasFilters =
    search !== "" || agentIds.length > 0 || types.length > 0 || statuses.length > 0 || range != null;

  const clearFilters = () => {
    setSearch("");
    setAgentIds([]);
    setTypes([]);
    setStatuses([]);
    setRange(undefined);
  };

  const toggle = <T,>(list: T[], setList: (next: T[]) => void, item: T) => {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const exportCsv = () => {
    const rows = txs ?? [];
    const header = "time,agent,type,from,to,amount,asset,status,hash";
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const body = rows.map((tx) =>
      [
        tx.time,
        escape(agentName(tx.agentId)),
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
    anchor.download = `nebula-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const tx = (txs ?? [])[index]!;
    return (
      <div style={style}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelected(tx)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelected(tx);
            }
          }}
          aria-label={`Transaction ${truncMiddle(tx.hash)}`}
          className="grid h-full w-full cursor-pointer items-center gap-3 border-b border-border px-4 text-left text-[13px] transition-colors hover:bg-elevated/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <span className="truncate text-muted-foreground">{fmtDateTime(tx.time)}</span>
          <span className="truncate">{agentName(tx.agentId)}</span>
          <TxTypeLabel type={tx.type} />
          <span className="truncate font-mono text-xs text-muted-foreground">
            {truncMiddle(tx.from)} → {truncMiddle(tx.to)}
          </span>
          <span className="text-right font-mono tabular">{fmtAmount(tx.amount, tx.asset)}</span>
          <span>
            <TxStatusBadge status={tx.status} />
          </span>
          <span className="flex items-center font-mono text-xs text-muted-foreground">
            {truncMiddle(tx.hash, 5, 5)}
            <span onClick={(e) => e.stopPropagation()}>
              <CopyButton value={tx.hash} label="Copy hash" className="ml-0.5" />
            </span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="wallet"
        title="Transactions"
        subtitle="Everything your wallet has signed, newest first."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!txs?.length}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {/* filter bar */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hash or address…"
            className="h-8 w-56"
            aria-label="Search by hash or address"
          />
          <MultiSelect
            label="Agent"
            options={(agents ?? []).map((a) => a.id)}
            selected={agentIds}
            onToggle={(id) => toggle(agentIds, setAgentIds, id)}
            renderOption={agentName}
          />
          <MultiSelect
            label="Type"
            options={ALL_TYPES}
            selected={types}
            onToggle={(t) => toggle(types, setTypes, t)}
            renderOption={(t) => TX_TYPE_META[t].label}
          />
          <MultiSelect
            label="Status"
            options={ALL_STATUSES}
            selected={statuses}
            onToggle={(s) => toggle(statuses, setStatuses, s)}
            renderOption={(s) => TX_STATUS_META[s].label}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 font-normal" aria-label="Filter by date range">
                <CalendarIcon className="size-3.5 text-muted-foreground" aria-hidden />
                {range?.from
                  ? `${format(range.from, "MMM d")} – ${range.to ? format(range.to, "MMM d") : "…"}`
                  : "Date range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={1} />
            </PopoverContent>
          </Popover>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
          <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
            {txs ? `${txs.length} transactions` : ""}
          </span>
        </div>

        {loading || !txs ? (
          <TableSkeleton rows={10} cols={6} className="p-5" />
        ) : txs.length === 0 ? (
          <EmptyState
            title="No matching transactions"
            subtitle={
              hasFilters
                ? "Nothing matches these filters. Widen the range or clear them."
                : "Once your agents start paying for things, activity lands here."
            }
            actionLabel={hasFilters ? "Clear filters" : undefined}
            onAction={hasFilters ? clearFilters : undefined}
          />
        ) : (
          <>
            {/* desktop virtualized table */}
            <div className="hidden sm:block">
              <div
                className="grid gap-3 border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground"
                style={{ gridTemplateColumns: GRID_COLS }}
                role="row"
              >
                <span>Time</span>
                <span>Agent</span>
                <span>Type</span>
                <span>From → to</span>
                <span className="text-right">Amount</span>
                <span>Status</span>
                <span>Hash</span>
              </div>
              <FixedSizeList
                height={Math.min(560, Math.max(160, txs.length * 52))}
                width="100%"
                itemCount={txs.length}
                itemSize={52}
              >
                {Row}
              </FixedSizeList>
            </div>
            {/* mobile card list */}
            <ul className="divide-y divide-border sm:hidden">
              {txs.slice(0, 40).map((tx) => (
                <li key={tx.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-3.5 text-left"
                    onClick={() => setSelected(tx)}
                    aria-label={`Transaction ${truncMiddle(tx.hash)}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <TxTypeLabel type={tx.type} />
                      <span className="font-mono text-[13px] tabular">
                        {fmtAmount(tx.amount, tx.asset)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {agentName(tx.agentId)} · {fmtDateTime(tx.time)}
                      </span>
                      <TxStatusBadge status={tx.status} />
                    </div>
                  </button>
                </li>
              ))}
              {txs.length > 40 ? (
                <li className="px-4 py-3 text-center text-xs text-muted-foreground">
                  Showing first 40 — refine filters to narrow down.
                </li>
              ) : null}
            </ul>
          </>
        )}
      </Card>

      {/* detail drawer */}
      <Sheet open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-1 font-mono text-base">
                  {truncMiddle(selected.hash, 8, 8)}
                  <CopyButton value={selected.hash} label="Copy transaction hash" />
                </SheetTitle>
                <SheetDescription>
                  {TX_TYPE_META[selected.type].label} · {fmtDateTime(selected.time)}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <TxStatusBadge status={selected.status} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Agent</dt>
                    <dd>{agentName(selected.agentId)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="font-mono tabular">{fmtAmount(selected.amount, selected.asset)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Fee</dt>
                    <dd className="font-mono tabular">{selected.fee} XLM</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">From</dt>
                    <dd className="flex items-center font-mono text-[13px]">
                      {truncMiddle(selected.from, 6, 6)}
                      <CopyButton value={selected.from} label="Copy sender address" />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">To</dt>
                    <dd className="flex items-center font-mono text-[13px]">
                      {truncMiddle(selected.to, 6, 6)}
                      <CopyButton value={selected.to} label="Copy recipient address" />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Memo</dt>
                    <dd className={cn(!selected.memo && "text-subtle")}>{selected.memo ?? "none"}</dd>
                  </div>
                </dl>

                <div>
                  <p className="mb-2 text-[13px] font-medium text-muted-foreground">Operations</p>
                  <ul className="space-y-1.5">
                    {selected.operations.map((op, i) => (
                      <li key={i} className="rounded-lg border border-border px-3 py-2 text-[13px]">
                        <span className="font-mono text-xs text-warm">{op.type}</span>
                        <span className="ml-2 break-all text-muted-foreground">{op.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-[13px] font-medium text-muted-foreground">Raw JSON</p>
                  <pre className="card-edge max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border bg-elevated/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                    {JSON.stringify(selected, null, 2)}
                  </pre>
                </div>

                {selected.hash.startsWith("hub_") ? (
                  <p className="text-[13px] text-muted-foreground">
                    Hub policy update (not an on-chain transaction).
                  </p>
                ) : (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${selected.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    View on Stellar Expert <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
