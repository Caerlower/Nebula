import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  field,
  formatBlendRate,
  formatContractReference,
  formatNetworkHeader,
  formatTxReference,
  linkField,
  section,
} from "../lib/format-output.js";
import { stellarExpertAccountUrl } from "../lib/explorer.js";
import { formatAmount } from "../utils/amount.js";
import { loadWalletFromEnv } from "../wallet.js";
import { getTreasuryBalances } from "../treasury/balances.js";
import { treasuryState } from "../treasury/state.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerGetTreasuryStatusTool(server: McpServer): void {
  server.registerTool(
    "get_treasury_status",
    {
      description:
        "Show liquid balance, Blend deposit, supply APY, liquidity threshold, and last rebalance for the configured treasury asset (default XLM on testnet).",
    },
    async () => {
      const wallet = loadWalletFromEnv();
      if (!wallet.ok) {
        return errorToolResult(wallet.error);
      }

      try {
        const balances = await getTreasuryBalances(wallet.keypair.publicKey());
        const threshold = treasuryState.getLiquidityThreshold();
        const last = treasuryState.lastRebalance;
        const symbol = balances.asset.symbol;
        const network = wallet.network.name;

        const lines = [
          ...formatNetworkHeader(network, "Treasury status"),
          field("Pool", "TestnetV2"),
          field("Asset", `${symbol} (${balances.asset.id})`),
          ...formatContractReference(
            network,
            balances.asset.reserveContract,
            "Reserve",
          ),
          section("Balances"),
          field(
            `Liquid ${symbol}`,
            `${formatAmount(balances.liquid)} (treasury-usable)`,
          ),
        ];

        if (balances.asset.id === "xlm" && balances.rawNativeXlm !== undefined) {
          lines.push(
            field("Native XLM total", formatAmount(balances.rawNativeXlm)),
            field("XLM fee buffer", formatAmount(balances.asset.feeBuffer)),
          );
        }

        if (balances.asset.id === "usdc" && balances.circleUsdc !== undefined) {
          lines.push(
            field(
              "Circle USDC",
              `${formatAmount(balances.circleUsdc)} (not usable in Blend)`,
            ),
          );
        }

        lines.push(
          field("Deposited in Blend", formatAmount(balances.blendDeposited)),
          field(
            "Blend supply APY",
            balances.supplyApy === null
              ? "unavailable"
              : formatBlendRate(balances.supplyApy),
          ),
          section("Rebalancer"),
          field(
            "Liquidity threshold",
            threshold === null
              ? "not set"
              : `${formatAmount(threshold)} ${symbol}`,
          ),
          field(
            "Rebalance interval",
            `${treasuryState.getRebalanceIntervalSeconds()}s`,
          ),
        );

        if (last) {
          lines.push(
            section("Last rebalance"),
            field("Asset", last.asset),
            field("Action", last.action),
            field("Reason", last.reason),
            field("Amount", `${formatAmount(last.amount)} ${last.asset}`),
            field("At", last.at),
          );
          if (last.hash) {
            lines.push(...formatTxReference(network, last.hash));
          }
          if (last.error) {
            lines.push(field("Error", last.error));
          }
        } else {
          lines.push(section("Last rebalance"), field("Status", "none yet"));
        }

        if (treasuryState.lastError && !last?.error) {
          lines.push(
            section("Treasury error"),
            field("Message", treasuryState.lastError),
          );
        }

        lines.push(
          linkField(
            "Wallet explorer",
            stellarExpertAccountUrl(network, wallet.keypair.publicKey()),
          ),
        );

        return textToolResult(lines.join("\n"));
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "Failed to read treasury status.",
        );
      }
    },
  );
}
