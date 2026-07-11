/** `undefined` = read from env; `null` = explicitly unset; number = override */
let liquidityThreshold: number | null | undefined = undefined;
let rebalanceIntervalSeconds: number | null | undefined = undefined;
let missingThresholdWarned = false;

function readThresholdFromEnv(): number | null {
  const raw = process.env.LIQUIDITY_THRESHOLD?.trim();
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    console.error(
      `[treasury] Invalid LIQUIDITY_THRESHOLD "${raw}". Must be a non-negative number.`,
    );
    return null;
  }

  return value;
}

function readRebalanceIntervalFromEnv(): number {
  const raw = process.env.REBALANCE_INTERVAL_SECONDS?.trim();
  if (!raw) {
    return 60;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(
      `[treasury] Invalid REBALANCE_INTERVAL_SECONDS "${raw}". Using default 60.`,
    );
    return 60;
  }

  return value;
}

export interface RebalanceSummary {
  action: "deposit" | "withdraw" | "none";
  reason: string;
  amount: number;
  liquidBefore: number;
  liquidAfter: number;
  blendBefore: number;
  blendAfter: number;
  threshold: number;
  asset: string;
  hash?: string;
  error?: string;
  at: string;
}

export const treasuryState = {
  getLiquidityThreshold(): number | null {
    if (liquidityThreshold !== undefined) {
      return liquidityThreshold;
    }
    return readThresholdFromEnv();
  },

  setLiquidityThreshold(value: number): void {
    liquidityThreshold = value;
  },

  getRebalanceIntervalSeconds(): number {
    if (rebalanceIntervalSeconds !== undefined) {
      return rebalanceIntervalSeconds;
    }
    return readRebalanceIntervalFromEnv();
  },

  warnMissingThresholdOnce(): void {
    if (missingThresholdWarned) {
      return;
    }
    missingThresholdWarned = true;
    console.error(
      "[treasury] LIQUIDITY_THRESHOLD is not set — auto-rebalance disabled. Add it to packages/mcp-server/.env or call set_liquidity_threshold.",
    );
  },

  lastRebalance: null as RebalanceSummary | null,
  lastError: null as string | null,
  loopRunning: false,
};

export function recordRebalance(summary: RebalanceSummary): void {
  treasuryState.lastRebalance = summary;
  treasuryState.lastError = summary.error ?? null;
}

export function recordRebalanceError(message: string): void {
  treasuryState.lastError = message;
}
