import type { NetworkName } from "./config.js";
import { getActiveMppSession } from "./mpp/session.js";
import { field, formatNetworkHeader, section } from "./lib/format-output.js";
import type { TransferAsset } from "./transfers.js";

interface SpendRecord {
  timestamp: number;
  amount: number;
  asset: TransferAsset;
}

export interface SpendingLimitsConfig {
  maxPerCall: number;
  maxPerDay: number;
}

export type LimitCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

export interface SpendingReport {
  maxPerCall: number;
  maxPerDay: number;
  dailySpent: number;
  mppSessionReserved: number;
  dailyRemaining: number;
  windowStartedAt: string | null;
  recentTransfers: Array<{
    asset: TransferAsset;
    amount: number;
    at: string;
  }>;
}

const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

function parsePositiveLimit(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number. Got "${raw}".`);
  }

  return value;
}

export function loadSpendingLimitsConfig():
  | { ok: true; config: SpendingLimitsConfig }
  | { ok: false; error: string } {
  try {
    const maxPerCall = parsePositiveLimit("MAX_PER_CALL");
    const maxPerDay = parsePositiveLimit("MAX_PER_DAY");

    if (maxPerCall === null || maxPerDay === null) {
      return {
        ok: false,
        error:
          "MAX_PER_CALL and MAX_PER_DAY must be set in the MCP server environment before transfers are allowed.",
      };
    }

    return { ok: true, config: { maxPerCall, maxPerDay } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

class SpendingLimitEngine {
  private records: SpendRecord[] = [];

  private pruneExpired(now = Date.now()): void {
    const cutoff = now - ROLLING_WINDOW_MS;
    this.records = this.records.filter((record) => record.timestamp > cutoff);
  }

  getDailySpent(now = Date.now()): number {
    this.pruneExpired(now);
    return this.records.reduce((sum, record) => sum + record.amount, 0);
  }

  /** Unspent MPP session budget still locked in the open channel. */
  getMppSessionReserved(): number {
    const session = getActiveMppSession();
    if (!session) {
      return 0;
    }

    const committed = Number(session.cumulativeStroops) / 10_000_000;
    return Math.max(session.budgetUsdc - committed, 0);
  }

  getEffectiveDailyExposure(now = Date.now()): number {
    return this.getDailySpent(now) + this.getMppSessionReserved();
  }

  checkTransfer(
    amount: number,
    config: SpendingLimitsConfig,
    now = Date.now(),
  ): LimitCheckResult {
    if (amount <= 0) {
      return { ok: false, reason: "Transfer amount must be greater than zero." };
    }

    if (amount > config.maxPerCall) {
      return {
        ok: false,
        reason: `Transfer blocked: ${amount} exceeds MAX_PER_CALL (${config.maxPerCall}).`,
      };
    }

    const dailySpent = this.getDailySpent(now);
    const mppReserved = this.getMppSessionReserved();
    const projected = this.getEffectiveDailyExposure(now) + amount;

    if (projected > config.maxPerDay) {
      const remaining = Math.max(
        config.maxPerDay - this.getEffectiveDailyExposure(now),
        0,
      );
      return {
        ok: false,
        reason:
          `Transfer blocked: ${amount} would exceed MAX_PER_DAY. ` +
          `Spent in last 24h: ${dailySpent}.` +
          (mppReserved > 0 ? ` MPP session reserved: ${mppReserved}.` : "") +
          ` Remaining: ${remaining}.`,
      };
    }

    return { ok: true };
  }

  recordTransfer(amount: number, asset: TransferAsset, now = Date.now()): void {
    this.pruneExpired(now);
    this.records.push({ timestamp: now, amount, asset });
  }

  getReport(config: SpendingLimitsConfig, now = Date.now()): SpendingReport {
    this.pruneExpired(now);
    const dailySpent = this.getDailySpent(now);
    const mppSessionReserved = this.getMppSessionReserved();

    return {
      maxPerCall: config.maxPerCall,
      maxPerDay: config.maxPerDay,
      dailySpent,
      mppSessionReserved,
      dailyRemaining: Math.max(
        config.maxPerDay - dailySpent - mppSessionReserved,
        0,
      ),
      windowStartedAt:
        this.records.length > 0
          ? new Date(
              Math.min(...this.records.map((record) => record.timestamp)),
            ).toISOString()
          : null,
      recentTransfers: [...this.records]
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((record) => ({
          asset: record.asset,
          amount: record.amount,
          at: new Date(record.timestamp).toISOString(),
        })),
    };
  }
}

export const spendingLimitEngine = new SpendingLimitEngine();

export function formatSpendingReport(
  report: SpendingReport,
  network: NetworkName = "testnet",
): string {
  const lines = [
    ...formatNetworkHeader(network, "Spending report"),
    section("Limits"),
    field("Per-call (MAX_PER_CALL)", String(report.maxPerCall)),
    field("Daily (MAX_PER_DAY)", String(report.maxPerDay)),
    field("Spent (rolling 24h)", String(report.dailySpent)),
  ];

  if (report.mppSessionReserved > 0) {
    lines.push(
      field("MPP session reserved", String(report.mppSessionReserved)),
    );
  }

  lines.push(field("Remaining today", String(report.dailyRemaining)));

  if (report.windowStartedAt) {
    lines.push(field("Oldest spend in window", report.windowStartedAt));
  }

  if (report.recentTransfers.length === 0) {
    lines.push(section("Recent transfers"), "  None in the current 24h window.");
  } else {
    lines.push(section("Recent transfers"));
    for (const transfer of report.recentTransfers) {
      lines.push(
        `  • ${transfer.amount} ${transfer.asset} at ${transfer.at}`,
      );
    }
  }

  return lines.join("\n");
}
