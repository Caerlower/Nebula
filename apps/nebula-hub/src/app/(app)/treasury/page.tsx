"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExternalLink, Loader2, MoreHorizontal } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { CopyButton } from "@/components/shared/copy-button";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as api from "@/lib/api";
import { fmtAmount, fmtDate, fmtUSD, fmtXLM, truncMiddle } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";
import type { BlendPosition, WalletSummary } from "@/types/domain";

const STELLAR_G_ADDRESS = /^G[A-Z2-7]{55}$/;

function DepositDialog({
  open,
  onOpenChange,
  wallet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: WalletSummary | null;
}) {
  const address = wallet?.address && wallet.address !== "—" ? wallet.address : null;
  const testnet = wallet?.network !== "mainnet";
  const friendbot = address
    ? `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit</DialogTitle>
          <DialogDescription>
            Send XLM or Circle USDC to this address. Idle XLM can earn on Blend
            when auto-yield is on; USDC is used for x402 / MPP.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          {/* Fixed light plate so QR modules stay readable in every theme */}
          <div className="rounded-lg bg-white p-3 shadow-sm" aria-hidden>
            {address ? (
              <QRCodeSVG
                value={address}
                size={132}
                bgColor="#ffffff"
                fgColor="#0a0a0a"
                level="M"
              />
            ) : (
              <div className="flex size-[132px] items-center justify-center text-xs text-neutral-400">
                No wallet
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-[13px] text-muted-foreground">Your Stellar address</p>
              {address ? (
                <div className="mt-1.5 flex items-start gap-1">
                  <p className="break-all font-mono text-sm leading-relaxed" title={address}>
                    {address}
                  </p>
                  <CopyButton value={address} label="Copy address" />
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Wallet not provisioned yet — finish login once.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {testnet && friendbot ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={friendbot} target="_blank" rel="noreferrer">
                    Fund XLM (Friendbot)
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </Button>
              ) : null}
              {testnet ? (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://faucet.circle.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Fund USDC (Circle)
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </Button>
              ) : null}
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              USDC requires a Circle trustline — open one on Connect if you
              haven&apos;t already.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({
  open,
  onOpenChange,
  wallet,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: WalletSummary | null;
  onSent: () => void;
}) {
  const [asset, setAsset] = useState<"XLM" | "USDC">("XLM");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  const liquidXlm = wallet?.liquidXLM ?? 0;
  const usdcBal = wallet?.usdcBalance ?? 0;
  const available = asset === "USDC" ? usdcBal : liquidXlm;

  const parsed = Number.parseFloat(amount);
  const destOk = STELLAR_G_ADDRESS.test(destination.trim());
  const amountOk = Number.isFinite(parsed) && parsed > 0;
  const underBalance = amountOk && parsed <= available + 1e-7;
  const valid = destOk && amountOk && underBalance;

  useEffect(() => {
    if (!open) {
      setAsset("XLM");
      setDestination("");
      setAmount("");
      setMemo("");
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const result = await api.withdrawFunds({
        asset,
        destination: destination.trim(),
        amount: parsed,
        memo: memo.trim() || undefined,
      });
      toast.success(`Sent ${parsed} ${asset}`, {
        description: `tx ${truncMiddle(result.txHash, 6, 6)}`,
        action: result.explorerUrl
          ? {
              label: "Explorer",
              onClick: () =>
                window.open(result.explorerUrl!, "_blank", "noreferrer"),
            }
          : undefined,
      });
      onSent();
      onOpenChange(false);
    } catch (err) {
      toast.error("Withdrawal failed", {
        description: err instanceof Error ? err.message : undefined,
        action: { label: "Retry", onClick: () => void submit() },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw</DialogTitle>
          <DialogDescription>
            Send from your Hub wallet. Privy signs on-chain.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={asset}
          onValueChange={(v) => {
            setAsset(v as "XLM" | "USDC");
            setAmount("");
          }}
        >
          <TabsList aria-label="Asset" className="w-full">
            <TabsTrigger value="XLM" className="flex-1">
              XLM
            </TabsTrigger>
            <TabsTrigger value="USDC" className="flex-1">
              USDC
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-[13px] text-muted-foreground">
          Available{" "}
          <span className="font-mono tabular text-foreground">
            {fmtAmount(available, asset)}
          </span>
        </p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="withdraw-dest">Destination (G…)</Label>
            <Input
              id="withdraw-dest"
              value={destination}
              onChange={(e) => setDestination(e.target.value.trim())}
              placeholder="G…"
              autoComplete="off"
              spellCheck={false}
              className={cn(
                "font-mono text-sm",
                destination && !destOk && "border-destructive",
              )}
              autoFocus
            />
            {destination && !destOk ? (
              <p className="text-[12px] text-destructive">Invalid Stellar address</p>
            ) : null}
            <p
              className={cn(
                "text-[12px] text-muted-foreground",
                asset !== "USDC" && "invisible",
              )}
              aria-hidden={asset !== "USDC"}
            >
              Destination must have a Circle USDC trustline.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="withdraw-amount">Amount ({asset})</Label>
              <button
                type="button"
                className="text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => setAmount(String(Math.max(0, available)))}
              >
                Max
              </button>
            </div>
            <Input
              id="withdraw-amount"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {amountOk && !underBalance ? (
              <p className="text-[12px] text-destructive">
                Exceeds available balance
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdraw-memo">Memo (optional)</Label>
            <Input
              id="withdraw-memo"
              value={memo}
              maxLength={28}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Up to 28 characters"
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!valid || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign &amp; send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AutoYieldCard() {
  const { data, loading, setData } = useLoad(() => api.getTreasurySettings(), []);
  const [draftLow, setDraftLow] = useState<string | null>(null);
  const [draftHigh, setDraftHigh] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lowText =
    draftLow ?? (data != null ? String(data.liquidityFloorXLM) : "");
  const highText =
    draftHigh ?? (data != null ? String(data.liquidityCeilingXLM) : "");

  const parsedLow = Number.parseFloat(lowText);
  const parsedHigh = Number.parseFloat(highText);
  const lowOk = Number.isFinite(parsedLow) && parsedLow >= 0;
  const highOk = Number.isFinite(parsedHigh) && parsedHigh >= 0;
  const bandOk = lowOk && highOk && parsedHigh >= parsedLow;

  const dirty =
    data != null &&
    ((draftLow != null && parsedLow !== data.liquidityFloorXLM) ||
      (draftHigh != null && parsedHigh !== data.liquidityCeilingXLM));

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

  const saveBand = async () => {
    if (!data || !bandOk) {
      toast.error("High must be ≥ low, and both must be ≥ 0");
      return;
    }
    setSaving(true);
    try {
      const next = await api.updateTreasurySettings({
        liquidityFloorXLM: parsedLow,
        liquidityCeilingXLM: parsedHigh,
      });
      setData(next);
      setDraftLow(null);
      setDraftHigh(null);
      toast.success(
        `Liquid band set to ${fmtUSD(next.liquidityFloorXLM)}–${fmtUSD(next.liquidityCeilingXLM)} USDC`,
      );
    } catch {
      toast.error("Couldn't save the liquid band", {
        action: { label: "Retry", onClick: () => void saveBand() },
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
                Above the high mark, funds go to work. Below the low mark, they come back.
              </p>
            </div>
            <Switch
              checked={data.autoYield}
              onCheckedChange={(next) => void toggleAuto(next)}
              aria-label="Auto-route idle funds to Blend"
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Liquid band (USDC)</p>
              {dirty ? (
                <Button
                  size="sm"
                  onClick={() => void saveBand()}
                  disabled={saving || !bandOk}
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Save
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="liquidity-low" className="text-sm font-normal">
                  Low
                </Label>
                <Input
                  id="liquidity-low"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={lowText}
                  onChange={(e) => setDraftLow(e.target.value)}
                  className="font-mono tabular"
                  aria-label="Liquid low cap in USDC"
                />
                <p className="text-[12px] text-muted-foreground">
                  Refill liquid when it dips below this
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="liquidity-high" className="text-sm font-normal">
                  High
                </Label>
                <Input
                  id="liquidity-high"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={highText}
                  onChange={(e) => setDraftHigh(e.target.value)}
                  className="font-mono tabular"
                  aria-label="Liquid high cap in USDC"
                />
                <p className="text-[12px] text-muted-foreground">
                  Send the excess to Blend above this
                </p>
              </div>
            </div>
            {dirty && !bandOk ? (
              <p className="text-[12px] text-destructive">
                High must be greater than or equal to low.
              </p>
            ) : null}
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
              <Tooltip content={YieldTooltip} cursor={{ stroke: "var(--border)" }} />
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

  const withdrawPosition = async (position: BlendPosition) => {
    const previous = positions ?? [];
    setPositions(previous.filter((p) => p.id !== position.id));
    try {
      const { txHash } = await api.withdrawPosition(position.id);
      toast.success(`Withdrew from ${position.pool}`, {
        description: `tx ${truncMiddle(txHash, 6, 6)}`,
      });
      void reloadWallet();
      void reloadPositions();
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
        accent="teal"
        title="Treasury"
        subtitle="Idle funds earn on Blend automatically. You decide how much stays liquid."
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
            <StatCard
              label="Liquid"
              tone="primary"
              footer={
                wallet.liquidityFloorXLM != null
                  ? `Spendable · band from ${fmtUSD(wallet.liquidityFloorXLM)} USDC`
                  : "Spendable for agent payments"
              }
            >
              <div>
                <AnimatedNumber
                  value={wallet.liquidXLM}
                  format={fmtXLM}
                  className="bg-[image:var(--gradient-primary)] bg-clip-text text-4xl font-semibold text-transparent"
                />
                <span className="ml-1.5 font-mono text-sm text-muted-foreground">
                  XLM
                </span>
              </div>
              {wallet.usdPerXlm != null ? (
                <p className="mt-1 font-mono text-sm tabular text-muted-foreground">
                  ≈ {fmtUSD(wallet.liquidXLM * wallet.usdPerXlm)} USDC
                </p>
              ) : null}
            </StatCard>
            <StatCard
              label="In Blend"
              tone="warm"
              footer={
                wallet.blendXLM > 0
                  ? `Earning on ${wallet.poolName ?? "Blend"}`
                  : "Nothing deposited yet"
              }
            >
              <div>
                <AnimatedNumber
                  value={wallet.blendXLM}
                  format={fmtXLM}
                  className="text-4xl font-semibold text-warm"
                />
                <span className="ml-1.5 font-mono text-sm text-muted-foreground">
                  XLM
                </span>
              </div>
              {wallet.usdPerXlm != null ? (
                <p className="mt-1 font-mono text-sm tabular text-muted-foreground">
                  ≈ {fmtUSD(wallet.blendXLM * wallet.usdPerXlm)} USDC
                </p>
              ) : null}
            </StatCard>
            <StatCard
              label="Supply APY"
              tone="teal"
              footer={
                wallet.blendXLM > 0
                  ? "Live Blend XLM rate on your position"
                  : "Live Blend XLM market rate"
              }
            >
              <AnimatedNumber
                value={wallet.apyPct}
                format={(v) => v.toFixed(2)}
                className="text-4xl font-semibold text-teal"
              />
              <span className="ml-1 font-mono text-sm text-muted-foreground">
                %
              </span>
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

      {wallet ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Total{" "}
          <span className="font-mono tabular text-foreground">
            {fmtXLM(wallet.balanceXLM)}
          </span>{" "}
          XLM
          {wallet.usdPerXlm != null ? (
            <>
              {" "}
              <span className="font-mono tabular text-foreground">
                (≈ {fmtUSD(wallet.balanceXLM * wallet.usdPerXlm)} USDC)
              </span>
            </>
          ) : null}
          <span className="text-subtle">
            {" "}
            · liquid {fmtXLM(wallet.liquidXLM)} + Blend {fmtXLM(wallet.blendXLM)}
          </span>
        </p>
      ) : null}

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Blend positions</p>
        </div>
        {positionsLoading || !positions ? (
          <TableSkeleton rows={3} cols={5} className="p-5" />
        ) : positions.length === 0 ? (
          <EmptyState
            title="No Blend positions"
            subtitle="Fund the wallet and enable auto-yield to start earning on idle balance."
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

      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        wallet={wallet}
      />
      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        wallet={wallet}
        onSent={() => {
          void reloadWallet();
          void reloadPositions();
        }}
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
