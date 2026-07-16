/**
 * Hub-provided execution context. Never contains a private key or mnemonic.
 * Signing is always performed by the Hub via Privy using `privyWalletId`.
 */
export interface ToolContext {
  userId: string;
  agentId: string | null;
  tokenId: string | null;
  stellarAddress: string;
  privyWalletId: string;
  network: "testnet" | "mainnet";
  /** Sign a Stellar transaction XDR; returns signed XDR. Hub/Privy only. */
  signTransactionXdr: (xdr: string) => Promise<string>;
  /** Broadcast a signed transaction; returns hash. */
  submitTransactionXdr: (signedXdr: string) => Promise<string>;
  /** Optional structured logger (Hub injects). */
  log?: (event: string, data?: Record<string, unknown>) => void;
}

export type ToolResultStatus =
  | "ok"
  | "confirmation_required"
  | "rejected"
  | "error";

export interface ToolOkResult {
  status: "ok";
  tx_hash?: string;
  explorer_url?: string;
  data?: Record<string, unknown>;
  message?: string;
}

export interface ToolConfirmationResult {
  status: "confirmation_required";
  confirmation_id: string;
  approve_url: string;
  expires_in: number;
  summary: string;
}

export interface ToolRejectedResult {
  status: "rejected";
  reason: string;
}

export interface ToolErrorResult {
  status: "error";
  reason: string;
}

export type ToolResult =
  | ToolOkResult
  | ToolConfirmationResult
  | ToolRejectedResult
  | ToolErrorResult;

export interface PolicySnapshot {
  /** All cap fields are USDC. */
  microThreshold: number;
  perTxCap: number;
  dailyCap: number;
  paused: boolean;
  whitelist: string[];
  denylist: string[];
  /** Confirmed spend in the last 24h, in USDC (XLM transfers converted). */
  dailySpentUsdc: number;
}

export interface ConfirmationDecision {
  action: "auto" | "confirm" | "reject";
  reason: string;
}
