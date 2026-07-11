"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, MoreHorizontal } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { AXIS_PROPS, GRID_PROPS, makeTooltip } from "@/components/shared/chart-bits";
import { ChartSkeleton, StatCardSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
import { fmtAmount, fmtDate, fmtXLM, truncMiddle } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { useUIStore } from "@/stores/ui";
import type { BlendPosition } from "@/mocks/types";

function AmountDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await onConfirm(parsed);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-2"
        >
          <Label htmlFor="amount-input">Amount (XLM)</Label>
          <Input
            id="amount-input"
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!valid || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AutoYieldCard() {
  const { data, loading, setData } = useLoad(() => api.getTreasurySettings(), []);
  const [draftFloor, setDraftFloor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const floor = draftFloor ?? data?.liquidityFloorXLM ?? 0;
  const dirty = data != null && draftFloor != null && draftFloor !== data.liquidityFloorXLM;

  const toggleAuto = async (next: boolean) => {
    if (!data) return;
    const previous = data;
    setData({ ...data, autoYield: next });
    try {
      await api.updateTreasurySettings({ autoYield: next });
      toast.success(next ? "Auto-yield enabled" : "Auto-yield paused");
    } catch {
      setData(previous);
      toast.error("Couldn't update auto-yield", {
        action: { label: "Retry", onClick: () => void toggleAuto(next) },
      });
    }
  };

  const saveFloor = async () => {
    if (!data || draftFloor == null) return;
    setSaving(true);
    try {
      const next = await api.updateTreasurySettings({ liquidityFloorXLM: draftFloor });
      setData(next);
      setDraftFloor(null);
      toast.success(`Liquidity floor set to ${fmtXLM(next.liquidityFloorXLM)} XLM`);
    } catch {
      toast.error("Couldn't save the liquidity floor", {
        action: { label: "Retry", onClick: () => void saveFloor() },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-muted-foreground">Auto-yield settings</p>
      {loading || !data ? (
        <TableSkeleton rows={2} cols={2} className="mt-4" />
      ) : (
        <div className="mt-4 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm">Auto-route idle funds to Blend</p>
              <p className="text-[13px] text-muted-foreground">
                Anything above the liquidity floor earns yield automatically.
              </p>
            </div>
            <Switch
              checked={data.autoYield}
              onCheckedChange={(next) => void toggleAuto(next)}
              aria-label="Auto-route idle funds to Blend"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="liquidity-floor" className="text-sm font-normal">
                Keep at least{" "}
                <span className="font-mono tabular text-foreground">{fmtXLM(floor)}</span> XLM liquid
              </Label>
              {dirty ? (
                <Button size="sm" onClick={() => void saveFloor()} disabled={saving}>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Save
                </Button>
              ) : null}
            </div>
            <Slider
              id="liquidity-floor"
              className="mt-3"
              min={0}
              max={10_000}
              step={100}
              value={[floor]}
              onValueChange={([value]) => setDraftFloor(value ?? 0)}
              aria-label="Liquidity floor in XLM"
            />
            <div className="mt-1.5 flex justify-between text-[11px] text-subtle">
              <span>0</span>
              <span>10,000 XLM</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function YieldChartCard() {
  const { data, loading } = useLoad(() => api.getBalanceHistory("90d"), []);
  const YieldTooltip = makeTooltip(
    (v) => fmtAmount(v, "XLM"),
    (label) => (typeof label === "string" ? fmtDate(label) : ""),
  );

  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-muted-foreground">Cumulative yield earned (90d)</p>
      {loading || !data ? (
        <ChartSkeleton height={220} className="mt-4" />
      ) : (
        <div className="mt-4 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fill-cum-yield" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.26} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis
                dataKey="time"
                {...AXIS_PROPS}
                tickFormatter={(v: string) => fmtDate(v)}
                minTickGap={48}
              />
              <YAxis {...AXIS_PROPS} width={48} />
              <Tooltip content={<YieldTooltip />} cursor={{ stroke: "var(--border)" }} />
              <Area
                type="monotone"
                dataKey="yield"
                name="Cumulative yield"
                stroke="var(--chart-3)"
                strokeWidth={2}
                fill="url(#fill-cum-yield)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export default function TreasuryPage() {
  const { data: wallet, reload: reloadWallet } = useLoad(() => api.getWallet(), []);
  const { data: positions, loading: positionsLoading, setData: setPositions, reload: reloadPositions } =
    useLoad(() => api.getBlendPositions(), []);

  const depositOpen = useUIStore((s) => s.depositOpen);
  const setDepositOpen = useUIStore((s) => s.setDepositOpen);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [detail, setDetail] = useState<BlendPosition | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<BlendPosition | null>(null);

  // command palette may set the flag before this page mounts
  useEffect(() => () => setDepositOpen(false), [setDepositOpen]);

  const deposit = async (amount: number) => {
    try {
      const { txHash } = await api.deposit(amount);
      toast.success(`Deposited ${fmtXLM(amount)} XLM`, {
        description: `tx ${truncMiddle(txHash, 6, 6)}`,
      });
      void reloadWallet();
    } catch {
      toast.error("Deposit failed", { action: { label: "Retry", onClick: () => void deposit(amount) } });
    }
  };

  const withdraw = async (amount: number) => {
    try {
      const { txHash } = await api.withdraw(amount);
      toast.success(`Withdrew ${fmtXLM(amount)} XLM`, {
        description: `tx ${truncMiddle(txHash, 6, 6)}`,
      });
      void reloadWallet();
    } catch (err) {
      toast.error("Withdrawal failed", {
        description: err instanceof Error ? err.message : undefined,
        action: { label: "Retry", onClick: () => void withdraw(amount) },
      });
    }
  };

  const withdrawPosition = async (position: BlendPosition) => {
    const previous = positions ?? [];
    setPositions(previous.filter((p) => p.id !== position.id));
    try {
      const { txHash } = await api.withdrawPosition(position.id);
      toast.success(`Withdrew from ${position.pool}`, {
        description: `tx ${truncMiddle(txHash, 6, 6)}`,
      });
      void reloadWallet();
    } catch {
      setPositions(previous);
      toast.error("Couldn't withdraw from the pool", {
        action: { label: "Retry", onClick: () => void withdrawPosition(position) },
      });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="wallet"
        title="Treasury"
        subtitle="Idle funds earn on Blend. Liquidity stays protected by your floor."
        actions={
          <>
            <Button variant="ghost" onClick={() => setWithdrawOpen(true)}>
              Withdraw
            </Button>
            <Button onClick={() => setDepositOpen(true)}>Deposit</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {wallet ? (
          <>
            <StatCard label="Total balance">
              <AnimatedNumber value={wallet.balanceXLM} format={fmtXLM} className="text-2xl font-medium" />
              <span className="ml-1.5 font-mono text-sm text-muted-foreground">XLM</span>
            </StatCard>
            <StatCard label="Idle balance" footer="Auto-earning on Blend">
              <AnimatedNumber value={wallet.idleXLM} format={fmtXLM} className="text-2xl font-medium text-warm" />
              <span className="ml-1.5 font-mono text-sm text-muted-foreground">XLM</span>
            </StatCard>
            <StatCard label="Blended APY" footer="Weighted across positions">
              <AnimatedNumber
                value={wallet.apyPct}
                format={(v) => v.toFixed(2)}
                className="text-2xl font-medium"
              />
              <span className="ml-1 font-mono text-sm text-muted-foreground">%</span>
            </StatCard>
          </>
        ) : (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        )}
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Blend positions</p>
        </div>
        {positionsLoading || !positions ? (
          <TableSkeleton rows={3} cols={5} className="p-5" />
        ) : positions.length === 0 ? (
          <EmptyState
            title="No Blend positions"
            subtitle="Deposit funds and enable auto-yield to start earning on idle balance."
            actionLabel="Deposit"
            onAction={() => setDepositOpen(true)}
          />
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pool</TableHead>
                    <TableHead className="text-right">Deposited</TableHead>
                    <TableHead className="text-right">APY</TableHead>
                    <TableHead className="text-right">Earned to date</TableHead>
                    <TableHead className="w-12" aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell>{position.pool}</TableCell>
                      <TableCell className="text-right font-mono tabular">
                        {fmtAmount(position.deposited, position.asset)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular">
                        {position.apyPct.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-mono tabular text-warm">
                        +{fmtAmount(position.earned, position.asset)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground"
                              aria-label={`Actions for ${position.pool}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setDetail(position)}>
                              Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setWithdrawTarget(position)}>
                              Withdraw
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* mobile cards */}
            <ul className="divide-y divide-border sm:hidden">
              {positions.map((position) => (
                <li key={position.id} className="flex items-start justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">{position.pool}</p>
                    <p className="mt-1 font-mono text-[13px] tabular text-muted-foreground">
                      {fmtAmount(position.deposited, position.asset)} · {position.apyPct.toFixed(2)}%
                    </p>
                    <p className="font-mono text-[13px] tabular text-warm">
                      +{fmtAmount(position.earned, position.asset)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWithdrawTarget(position)}
                    aria-label={`Withdraw from ${position.pool}`}
                  >
                    Withdraw
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AutoYieldCard />
        <YieldChartCard />
      </div>

      <AmountDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        title="Deposit XLM"
        description="Move funds into your agent's wallet."
        confirmLabel="Deposit"
        onConfirm={deposit}
      />
      <AmountDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title="Withdraw XLM"
        description="Move funds back to your own wallet."
        confirmLabel="Withdraw"
        onConfirm={withdraw}
      />

      <Dialog open={detail != null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{detail?.pool}</DialogTitle>
            <DialogDescription>Position detail</DialogDescription>
          </DialogHeader>
          {detail ? (
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Deposited</dt>
                <dd className="font-mono tabular">{fmtAmount(detail.deposited, detail.asset)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Current APY</dt>
                <dd className="font-mono tabular">{detail.apyPct.toFixed(2)}%</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Earned to date</dt>
                <dd className="font-mono tabular text-warm">+{fmtAmount(detail.earned, detail.asset)}</dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={withdrawTarget != null}
        onOpenChange={(open) => !open && setWithdrawTarget(null)}
        title={`Withdraw from ${withdrawTarget?.pool ?? "pool"}?`}
        description="The full deposited amount returns to your liquid balance. Earned yield is included."
        confirmLabel="Withdraw position"
        onConfirm={() => {
          if (withdrawTarget) return withdrawPosition(withdrawTarget);
        }}
      />
    </div>
  );
}
