"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  ExternalLink,
  Loader2,
  QrCode,
} from "lucide-react";

import { CopyButton } from "@/components/shared/copy-button";
import { TableSkeleton } from "@/components/shared/skeletons";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SectionRule } from "@/components/design/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import { fmtUSD, fmtXLM, truncMiddle } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";
import type { BlendPosition } from "@/types/domain";

const STELLAR_G_ADDRESS = /^G[A-Z2-7]{55}$/;

export default function TreasuryPage() {
  const { selectedAgentId, selectedAgent } = useAgentScope();
  const { data: wallet, reload: reloadWallet } = useLoad(
    () => api.getWallet(),
    [selectedAgentId],
  );
  const { data: positions, setData: setPositions, reload: reloadPositions } =
    useLoad(() => api.getBlendPositions(), [selectedAgentId]);
  const { data: settings, setData: setSettings } = useLoad(
    () => api.getTreasurySettings(),
    [selectedAgentId],
  );

  const depositOpen = useUIStore((s) => s.depositOpen);
  const setDepositOpen = useUIStore((s) => s.setDepositOpen);
  const [withdrawTarget, setWithdrawTarget] = useState<BlendPosition | null>(null);
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [withdrawAsset, setWithdrawAsset] = useState<"USDC" | "XLM">("USDC");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // Auto-yield management state
  const [draftLow, setDraftLow] = useState<string | null>(null);
  const [draftHigh, setDraftHigh] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOffOpen, setConfirmOffOpen] = useState(false);
  const [blendInYield, setBlendInYield] = useState(0);
  const [switchBusy, setSwitchBusy] = useState(false);
  const [editingBand, setEditingBand] = useState(false);

  // ⌘K "Fund wallet" lands here — open the deposit tab + QR.
  useEffect(() => {
    if (!depositOpen) return;
    setActiveTab("deposit");
    setQrOpen(true);
    setDepositOpen(false);
  }, [depositOpen, setDepositOpen]);

  useEffect(() => {
    setAmount("0.00");
    setDestination("");
  }, [activeTab, withdrawAsset, selectedAgentId]);

  const depositAddress =
    wallet?.address && wallet.address !== "—" ? wallet.address : null;
  const testnet = wallet?.network !== "mainnet";
  const friendbot = depositAddress
    ? `https://friendbot.stellar.org?addr=${encodeURIComponent(depositAddress)}`
    : null;

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

  // Auto-yield settings logic
  const lowText =
    draftLow ?? (settings != null ? String(settings.liquidityFloorXLM) : "");
  const highText =
    draftHigh ?? (settings != null ? String(settings.liquidityCeilingXLM) : "");

  const parsedLow = Number.parseFloat(lowText);
  const parsedHigh = Number.parseFloat(highText);
  const lowOk = Number.isFinite(parsedLow) && parsedLow >= 0;
  const highOk = Number.isFinite(parsedHigh) && parsedHigh >= 0;
  const bandOk = lowOk && highOk && parsedHigh >= parsedLow;

  const dirty =
    settings != null &&
    ((draftLow != null && parsedLow !== settings.liquidityFloorXLM) ||
      (draftHigh != null && parsedHigh !== settings.liquidityCeilingXLM));

  const enableAutoYield = async () => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, autoYield: true });
    setSwitchBusy(true);
    try {
      await api.updateTreasurySettings({ autoYield: true });
      toast.success("Auto-yield enabled");
    } catch {
      setSettings(previous);
      toast.error("Couldn't update auto-yield", {
        action: { label: "Retry", onClick: () => void enableAutoYield() },
      });
    } finally {
      setSwitchBusy(false);
    }
  };

  const requestDisableAutoYield = async () => {
    setSwitchBusy(true);
    try {
      const positions = await api.getBlendPositions();
      const total = positions.reduce((sum, p) => sum + (p.deposited ?? 0), 0);
      setBlendInYield(total);
      setConfirmOffOpen(true);
    } catch {
      setBlendInYield(0);
      setConfirmOffOpen(true);
    } finally {
      setSwitchBusy(false);
    }
  };

  const confirmDisableAutoYield = async () => {
    if (!settings) return;
    const previous = settings;
    try {
      const { settings: updatedSettings, withdrawnXlm, txHashes } =
        await api.disableAutoYieldAndUnwind();
      setSettings(updatedSettings);
      if (withdrawnXlm > 0 && txHashes[0]) {
        toast.success("Auto-yield off · Blend withdrawn", {
          description: `${fmtXLM(withdrawnXlm)} XLM returned to liquid · tx ${truncMiddle(txHashes[0], 6, 6)}`,
        });
      } else if (withdrawnXlm > 0) {
        toast.success("Auto-yield off · Blend withdrawn", {
          description: `${fmtXLM(withdrawnXlm)} XLM returned to liquid`,
        });
      } else {
        toast.success("Auto-yield paused");
      }
      void reloadWallet();
      void reloadPositions();
    } catch (error) {
      setSettings(previous);
      toast.error("Couldn't turn off auto-yield", {
        description:
          error instanceof Error ? error.message : "Withdraw or settings update failed",
        action: {
          label: "Retry",
          onClick: () => void confirmDisableAutoYield(),
        },
      });
      throw error;
    }
  };

  const saveBand = async () => {
    if (!settings || !bandOk) {
      toast.error("High must be ≥ low, and both must be ≥ 0");
      return;
    }
    setSaving(true);
    try {
      const next = await api.updateTreasurySettings({
        liquidityFloorXLM: parsedLow,
        liquidityCeilingXLM: parsedHigh,
      });
      setSettings(next);
      setDraftLow(null);
      setDraftHigh(null);
      toast.success(
        `Liquid band set to ${fmtUSD(next.liquidityFloorXLM)}–${fmtUSD(next.liquidityCeilingXLM)} USDC`,
      );
    } catch (error) {
      toast.error("Couldn't save the liquid band", {
        description:
          error instanceof Error
            ? error.message
            : "Check the agent has XLM for fees, then retry.",
        action: { label: "Retry", onClick: () => void saveBand() },
      });
    } finally {
      setSaving(false);
    }
  };

  const parsedAmount = Number.parseFloat(String(amount).replace(/,/g, ""));
  const isAmountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  // Spendable = Circle USDC only — never treat XLM·FX as USDC spendable.
  const spendableUsdc = wallet?.usdcBalance ?? 0;
  const liquidXlm = wallet?.liquidXLM ?? 0;
  const blendXlm = wallet?.blendXLM ?? 0;
  const rate = wallet?.usdPerXlm ?? 0;
  const blendUsd = rate > 0 ? blendXlm * rate : 0;
  const splitTotal = Math.max(spendableUsdc + blendUsd, 1e-9);
  const liquidBarPct = Math.min(100, (spendableUsdc / splitTotal) * 100);
  const blendBarPct = Math.min(100, (blendUsd / splitTotal) * 100);

  const available =
    activeTab === "withdraw" && withdrawAsset === "XLM"
      ? liquidXlm
      : spendableUsdc;

  const afterUsdc =
    activeTab === "deposit" && isAmountValid
      ? spendableUsdc + parsedAmount
      : activeTab === "withdraw" &&
          withdrawAsset === "USDC" &&
          isAmountValid
        ? Math.max(0, spendableUsdc - parsedAmount)
        : spendableUsdc;
  const afterBlend = blendUsd;
  const afterTotal = afterUsdc + afterBlend;
  const est30d = (blendUsd * (wallet?.apyPct ?? 0)) / 100 / 12;

  // Band thresholds are USDC-denominated; live marker tracks spendable USDC.
  const floorUSD = settings?.liquidityFloorXLM ?? 0;
  const ceilingUSD = settings?.liquidityCeilingXLM ?? 0;
  const maxScale = Math.max(ceilingUSD * 1.2, spendableUsdc, floorUSD, 1);
  const floorPct = (floorUSD / maxScale) * 100;
  const ceilingPct = (ceilingUSD / maxScale) * 100;
  const livePct = Math.min(100, (spendableUsdc / maxScale) * 100);
  const widthPct = Math.max(0, ceilingPct - floorPct);

  const amountDisplay = isAmountValid
    ? parsedAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

  const destOk = STELLAR_G_ADDRESS.test(destination.trim());
  const underBalance = isAmountValid && parsedAmount <= available + 1e-7;
  const canWithdraw =
    activeTab === "withdraw" &&
    isAmountValid &&
    underBalance &&
    destOk &&
    !withdrawBusy;

  const formatChip = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const submitWithdraw = async () => {
    if (!canWithdraw) return;
    setWithdrawBusy(true);
    try {
      const result = await api.withdrawFunds({
        asset: withdrawAsset,
        destination: destination.trim(),
        amount: parsedAmount,
      });
      toast.success(`Sent ${amountDisplay} ${withdrawAsset}`, {
        description: `tx ${truncMiddle(result.txHash, 6, 6)}`,
        action: result.explorerUrl
          ? {
              label: "Explorer",
              onClick: () =>
                window.open(result.explorerUrl!, "_blank", "noreferrer"),
            }
          : undefined,
      });
      setAmount("0.00");
      setDestination("");
      void reloadWallet();
      void reloadPositions();
    } catch (err) {
      toast.error("Withdrawal failed", {
        description: err instanceof Error ? err.message : undefined,
        action: { label: "Retry", onClick: () => void submitWithdraw() },
      });
    } finally {
      setWithdrawBusy(false);
    }
  };

  const toggleBandEdit = async () => {
    if (editingBand && dirty && bandOk) {
      await saveBand();
      setEditingBand(false);
      return;
    }
    setEditingBand((v) => !v);
  };

  return (
    <div>
      <div className="mb-8">
        <SectionRule>TREASURY · {selectedAgent?.name}</SectionRule>
        <h1 className="page-title">Liquid band and yield</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="soft-panel" style={{ padding: "30px 32px" }}>
          {wallet && settings ? (
            <>
              <div className="grid grid-cols-2 gap-[34px]">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                    LIQUID · SPENDABLE NOW
                  </p>
                  <p className="mt-3 font-mono text-[34px] leading-none tracking-[-0.02em] tabular-nums">
                    {fmtUSD(spendableUsdc)}
                  </p>
                  <p className="mt-1.5 font-mono text-[10px] text-subtle">USDC</p>
                  <div
                    className="mt-4 h-[6px] bg-warm"
                    style={{ width: `${liquidBarPct}%` }}
                  />
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                    BLEND POSITION
                  </p>
                  <p className="mt-3 font-mono text-[34px] leading-none tracking-[-0.02em] tabular-nums">
                    {fmtUSD(blendUsd)}
                  </p>
                  {blendXlm > 0 ? (
                    <p className="mt-1.5 font-mono text-[10px] text-subtle">
                      {fmtXLM(blendXlm)} XLM IN POOL
                    </p>
                  ) : (
                    <p className="mt-1.5 font-mono text-[10px] text-subtle">
                      XLM YIELD POSITION
                    </p>
                  )}
                  <div
                    className="mt-4 h-[6px] bg-primary"
                    style={{ width: `${blendBarPct}%` }}
                  />
                </div>
              </div>

              <div className="mt-8 border-t border-border pt-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                    YIELD BAND
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {!settings.autoYield ? (
                      <button
                        type="button"
                        onClick={() => void enableAutoYield()}
                        disabled={switchBusy}
                        className="rounded-full border border-primary/40 px-3 py-[5px] font-mono text-[10px] tracking-[0.12em] text-primary-2 disabled:opacity-50"
                      >
                        {switchBusy ? "ENABLING…" : "ENABLE AUTO-YIELD"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void requestDisableAutoYield()}
                        disabled={switchBusy}
                        className="rounded-full border border-border-strong px-3 py-[5px] font-mono text-[10px] tracking-[0.12em] text-muted-foreground hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
                      >
                        {switchBusy ? "UPDATING…" : "AUTO-YIELD ON · TURN OFF"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void toggleBandEdit()}
                      disabled={saving}
                      className="rounded-full border border-border-strong px-3 py-[5px] font-mono text-[10px] tracking-[0.12em] text-muted-foreground disabled:opacity-50"
                    >
                      {saving
                        ? "SAVING…"
                        : editingBand
                          ? dirty
                            ? "SAVE BAND"
                            : "DONE"
                          : "EDIT BAND"}
                    </button>
                  </div>
                </div>
                <p className="mt-2.5 max-w-[520px] text-[13px] text-pretty text-muted-foreground">
                  Nebula keeps the liquid balance inside this band. Below the floor it
                  unwinds from Blend; above the ceiling it sweeps the excess in.
                </p>

                <div className="relative mt-5">
                  <div className="relative h-5">
                    <span
                      className="absolute top-0 font-mono text-[9px] tracking-[0.1em] text-primary-2 whitespace-nowrap"
                      style={
                        livePct < 14
                          ? { left: 0 }
                          : livePct > 86
                            ? { left: "100%", transform: "translateX(-100%)" }
                            : { left: `${livePct}%`, transform: "translateX(-50%)" }
                      }
                    >
                      LIVE USDC {fmtUSD(spendableUsdc).replace("$", "")}
                    </span>
                  </div>
                  <div className="relative h-2 rounded-md border border-border bg-[var(--panel-3)]">
                    <div
                      className="absolute -top-px -bottom-px rounded-md bg-warm/50"
                      style={{ left: `${floorPct}%`, width: `${widthPct}%` }}
                      title="Yield band (floor → ceiling)"
                    />
                    <div
                      className="absolute -top-[7px] -bottom-[7px] w-0.5 bg-primary-2"
                      style={{ left: `${livePct}%` }}
                      title="Your spendable USDC right now"
                    />
                  </div>
                  <p className="mt-2 font-mono text-[9px] tracking-[0.08em] text-subtle">
                    SAND = TARGET BAND · PURPLE MARKER = SPENDABLE USDC NOW
                  </p>
                </div>

                <div className="mt-[22px] grid grid-cols-2 gap-6">
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                      LOWER · LIQUID FLOOR
                    </p>
                    {editingBand ? (
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={lowText}
                        onChange={(e) => setDraftLow(e.target.value)}
                        className="mt-2 h-auto rounded-xl border-primary-2 bg-[var(--panel-3)] px-3 py-2 font-mono text-[19px]"
                      />
                    ) : (
                      <p className="mt-2 font-mono text-[22px] tabular-nums">
                        {fmtUSD(settings.liquidityFloorXLM)}
                      </p>
                    )}
                    <p className="mt-1.5 font-mono text-[10px] text-subtle">
                      Below: unwind from Blend
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                      UPPER · SWEEP CEILING
                    </p>
                    {editingBand ? (
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={highText}
                        onChange={(e) => setDraftHigh(e.target.value)}
                        className="mt-2 h-auto rounded-xl border-primary-2 bg-[var(--panel-3)] px-3 py-2 font-mono text-[19px]"
                      />
                    ) : (
                      <p className="mt-2 font-mono text-[22px] tabular-nums">
                        {fmtUSD(settings.liquidityCeilingXLM)}
                      </p>
                    )}
                    <p className="mt-1.5 font-mono text-[10px] text-subtle">
                      Above: sweep excess to Blend
                    </p>
                  </div>
                </div>

                {editingBand && dirty && !bandOk ? (
                  <p className="mt-3 text-[12px] text-destructive">
                    High must be greater than or equal to low.
                  </p>
                ) : null}
              </div>

              <div className="mt-8 border-t border-border pt-6">
                <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                  POSITION DETAIL
                </p>
                {(
                  [
                    { label: "BLEND POOL", val: wallet.poolName ?? "Blend", fg: undefined },
                    {
                      label: "LIVE APY",
                      val: `${wallet.apyPct.toFixed(2)}%`,
                      fg: "text-primary",
                    },
                    {
                      label: "EARNED · 30D",
                      val: `+${fmtUSD((wallet.yield30dXLM || 0) * (rate || 0))}`,
                      fg: "text-primary",
                    },
                    { label: "UNWIND TIME", val: "~5S", fg: undefined },
                    {
                      label: "COMMITTED IN CHANNELS",
                      val: fmtUSD(0),
                      fg: undefined,
                    },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between border-b border-border py-3.5"
                  >
                    <span className="font-mono text-[11px] tracking-[0.05em] text-muted-foreground">
                      {row.label}
                    </span>
                    <span className={cn("font-mono text-[13px]", row.fg)}>{row.val}</span>
                  </div>
                ))}
                <p className="mt-5 max-w-[520px] text-[13px] text-pretty text-muted-foreground">
                  Idle funds above your liquid floor sweep into Blend automatically. If a
                  payment needs more than the liquid band holds, Nebula unwinds the
                  position first — settlement takes about 5 seconds longer.
                </p>
              </div>
            </>
          ) : (
            <TableSkeleton rows={4} cols={2} />
          )}
        </div>

        <div className="soft-panel bg-elevated" style={{ padding: "30px 28px" }}>
          <div className="mb-[22px] flex gap-1.5">
            {(
              [
                ["deposit", "DEPOSIT"],
                ["withdraw", "WITHDRAW"],
              ] as const
            ).map(([id, label]) => {
              const on = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex-1 rounded-full border border-border-strong py-2 font-mono text-[11px] tracking-[0.1em]",
                    !on && "bg-transparent text-muted-foreground",
                  )}
                  style={
                    on
                      ? { background: "var(--btn-bg)", color: "var(--btn-fg)" }
                      : undefined
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>

          {activeTab === "deposit" ? (
            <>
              <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                AGENT DEPOSIT ADDRESS
              </p>
              <p className="mt-2 text-[13px] text-pretty text-muted-foreground">
                Send XLM or Circle USDC to this address. On mainnet, idle XLM and
                USDC can earn in Blend (Fixed / YieldBlox); USDC also funds x402 / MPP.
              </p>

              {depositAddress ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-[var(--panel-3)] px-3.5 py-3">
                  <p
                    className="min-w-0 flex-1 break-all font-mono text-[12px] leading-relaxed"
                    title={depositAddress}
                  >
                    {depositAddress}
                  </p>
                  <CopyButton
                    value={depositAddress}
                    label="Copy address"
                    className="size-8 shrink-0 text-subtle hover:text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setQrOpen(true)}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                    aria-label="Show QR code"
                    title="Show QR code"
                  >
                    <QrCode className="size-4" />
                  </button>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-border bg-[var(--panel-3)] px-3.5 py-4 text-sm text-muted-foreground">
                  Wallet not provisioned yet — finish agent setup first.
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
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

              <div className="mt-[26px] border-t border-border pt-[18px]">
                <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                  CURRENT HOLDINGS
                </p>
                {(
                  [
                    { label: "LIQUID USDC", val: fmtUSD(spendableUsdc) },
                    { label: "LIQUID XLM", val: `${fmtXLM(liquidXlm)} XLM` },
                    { label: "IN BLEND YIELD", val: fmtUSD(afterBlend) },
                    { label: "TOTAL USDC", val: fmtUSD(afterTotal) },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between py-2.5 font-mono text-[11px]"
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span>{row.val}</span>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">
                Funds appear after the network confirms. USDC needs a Circle
                trustline on this agent (open one from Overview if needed).
              </p>
            </>
          ) : (
            <>
              <div className="mb-4 flex gap-1.5">
                {(["USDC", "XLM"] as const).map((asset) => {
                  const on = withdrawAsset === asset;
                  return (
                    <button
                      key={asset}
                      type="button"
                      onClick={() => setWithdrawAsset(asset)}
                      className={cn(
                        "flex-1 rounded-[10px] border py-2 font-mono text-[10px] tracking-[0.1em]",
                        on
                          ? "border-primary text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {asset}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                  AMOUNT · {withdrawAsset}
                </p>
                <p className="font-mono text-[10px] tracking-[0.08em] text-subtle tabular-nums">
                  AVAIL{" "}
                  {withdrawAsset === "XLM"
                    ? `${fmtXLM(liquidXlm)} XLM`
                    : fmtUSD(spendableUsdc)}
                </p>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-2.5 w-full rounded-xl border border-border bg-[var(--panel-3)] px-3.5 py-3.5 font-mono text-[24px] tracking-[-0.02em] outline-none focus:border-primary-2"
                placeholder="0.00"
                aria-label={`Amount in ${withdrawAsset}`}
              />

              <div className="mt-2.5 flex gap-1.5">
                {(
                  [
                    ["500", "500"],
                    ["2000", "2,000"],
                    ["4000", "4,000"],
                    ["max", "MAX"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      if (value === "max") {
                        setAmount(formatChip(Math.max(0, available)));
                      } else {
                        setAmount(formatChip(Number(value)));
                      }
                    }}
                    className="flex-1 rounded-[10px] border border-border py-2 font-mono text-[10px] tracking-[0.08em] text-muted-foreground"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                  DESTINATION
                </p>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value.trim())}
                  placeholder="G…"
                  autoComplete="off"
                  spellCheck={false}
                  className={cn(
                    "mt-2.5 w-full rounded-xl border bg-[var(--panel-3)] px-3.5 py-3 font-mono text-[13px] outline-none focus:border-primary-2",
                    destination && !destOk
                      ? "border-destructive"
                      : "border-border",
                  )}
                  aria-label="Destination Stellar address"
                />
                {destination && !destOk ? (
                  <p className="mt-1.5 text-[12px] text-destructive">
                    Invalid Stellar address
                  </p>
                ) : null}
                {withdrawAsset === "USDC" ? (
                  <p className="mt-1.5 font-mono text-[10px] text-subtle">
                    Destination must hold a Circle USDC trustline
                  </p>
                ) : null}
                {isAmountValid && !underBalance ? (
                  <p className="mt-1.5 text-[12px] text-destructive">
                    Exceeds available balance
                  </p>
                ) : null}
              </div>

              <div className="mt-[26px] border-t border-border pt-[18px]">
                <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                  AFTER THIS WITHDRAWAL
                </p>
                {(
                  [
                    { label: "LIQUID USDC", val: fmtUSD(afterUsdc) },
                    { label: "IN BLEND YIELD", val: fmtUSD(afterBlend) },
                    { label: "TOTAL", val: fmtUSD(afterTotal) },
                    {
                      label: "EST. 30D YIELD",
                      val: `+${fmtUSD(est30d)}`,
                      accent: true,
                    },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between py-2.5 font-mono text-[11px]"
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span
                      className={
                        "accent" in row && row.accent ? "text-primary" : undefined
                      }
                    >
                      {row.val}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={!canWithdraw}
                onClick={() => void submitWithdraw()}
                className="mt-5 w-full rounded-full py-[13px] text-[13px] font-semibold disabled:opacity-50"
                style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
              >
                {withdrawBusy ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Signing…
                  </span>
                ) : (
                  `Withdraw ${amountDisplay} ${withdrawAsset}`
                )}
              </button>
            </>
          )}

          <p className="mt-3 text-center font-mono text-[10px] tracking-[0.06em] text-subtle">
            SIGNED BY PRIVY · AGENT HOLDS NO KEY
          </p>
        </div>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Deposit QR</DialogTitle>
            <DialogDescription>
              Scan to send XLM or USDC to this agent.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <div className="rounded-lg bg-white p-3 shadow-sm" aria-hidden>
              {depositAddress ? (
                <QRCodeSVG
                  value={depositAddress}
                  size={168}
                  bgColor="#ffffff"
                  fgColor="#0F0F0F"
                  level="M"
                />
              ) : (
                <div className="flex size-[168px] items-center justify-center text-xs text-neutral-400">
                  No wallet
                </div>
              )}
            </div>
          </div>
          {depositAddress ? (
            <p className="break-all text-center font-mono text-[11px] text-muted-foreground">
              {depositAddress}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOffOpen}
        onOpenChange={setConfirmOffOpen}
        title="Turn off auto-yield?"
        description={
          blendInYield > 0
            ? `This withdraws about ${fmtXLM(blendInYield)} XLM from Blend back to liquid and stops parking idle funds. Yield stops accruing after the withdraw.`
            : "This stops parking idle funds into Blend. Any XLM still in Blend will be withdrawn to liquid."
        }
        confirmLabel={
          blendInYield > 0 ? "Withdraw & turn off" : "Turn off auto-yield"
        }
        destructive
        onConfirm={() => confirmDisableAutoYield()}
      />

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
