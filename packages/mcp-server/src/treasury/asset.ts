import {
  BLEND_TESTNET_USDC_ASSET,
  BLEND_TESTNET_XLM_ASSET,
} from "../blend/config.js";
import { getNetworkConfig } from "../config.js";
import type { TransferAsset } from "../transfers.js";

export type TreasuryAssetId = "xlm" | "usdc";

export interface TreasuryAssetConfig {
  id: TreasuryAssetId;
  symbol: TransferAsset;
  reserveContract: string;
  /** Native XLM kept on hand for fees and ledger reserves (xlm treasury only). */
  feeBuffer: number;
}

const DEFAULT_XLM_FEE_BUFFER = 5;

function parseTreasuryAssetId(): TreasuryAssetId {
  const raw = (process.env.TREASURY_ASSET ?? "xlm").trim().toLowerCase();

  if (raw === "xlm" || raw === "usdc") {
    return raw;
  }

  console.error(
    `[treasury] Invalid TREASURY_ASSET "${raw}". Using "xlm".`,
  );
  return "xlm";
}

function parseXlmFeeBuffer(): number {
  const raw = process.env.XLM_FEE_BUFFER?.trim();
  if (!raw) {
    return DEFAULT_XLM_FEE_BUFFER;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    console.error(
      `[treasury] Invalid XLM_FEE_BUFFER "${raw}". Using ${DEFAULT_XLM_FEE_BUFFER}.`,
    );
    return DEFAULT_XLM_FEE_BUFFER;
  }

  return value;
}

export function getTreasuryAssetConfig(): TreasuryAssetConfig {
  const network = getNetworkConfig();
  const id = parseTreasuryAssetId();

  if (network.name !== "testnet") {
    throw new Error("Treasury is configured for testnet only.");
  }

  if (id === "usdc") {
    return {
      id: "usdc",
      symbol: "USDC",
      reserveContract: BLEND_TESTNET_USDC_ASSET,
      feeBuffer: 0,
    };
  }

  return {
    id: "xlm",
    symbol: "XLM",
    reserveContract: BLEND_TESTNET_XLM_ASSET,
    feeBuffer: parseXlmFeeBuffer(),
  };
}
