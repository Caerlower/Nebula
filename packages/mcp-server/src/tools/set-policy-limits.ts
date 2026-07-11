import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { formatSetPolicyLimitsResult } from "../policy/format.js";
import { loadPolicyContractId } from "../policy/config.js";
import { setPolicyLimits } from "../policy/status.js";
import { parsePositiveAmount } from "../utils/amount.js";
import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerSetPolicyLimitsTool(server: McpServer): void {
  server.registerTool(
    "set_policy_limits",
    {
      description:
        "Update on-chain per-call and daily spending limits on the Nebula policy contract (owner-only, no redeploy). Amounts are in XLM/USDC units (7 decimals).",
      inputSchema: {
        max_per_call: z
          .string()
          .describe("New per-call limit (e.g. 10 for 10 XLM/USDC)."),
        max_per_day: z
          .string()
          .describe("New rolling 24h daily limit (e.g. 50)."),
      },
    },
    async ({ max_per_call, max_per_day }) => {
      try {
        const contract = loadPolicyContractId();
        if (!contract.ok) {
          return errorToolResult(contract.error);
        }

        const wallet = loadWalletFromEnv();
        if (!wallet.ok) {
          return errorToolResult(wallet.error);
        }

        const perCall = parsePositiveAmount(max_per_call);
        if (!perCall.ok) {
          return errorToolResult(perCall.error);
        }

        const perDay = parsePositiveAmount(max_per_day);
        if (!perDay.ok) {
          return errorToolResult(perDay.error);
        }

        const result = await setPolicyLimits({
          keypair: wallet.keypair,
          network: wallet.network,
          maxPerCall: perCall.numeric,
          maxPerDay: perDay.numeric,
          contractId: contract.contractId,
        });
        if (!result.ok) {
          return errorToolResult(result.error);
        }

        return textToolResult(
          formatSetPolicyLimitsResult({
            contractId: contract.contractId,
            maxPerCall: perCall.numeric,
            maxPerDay: perDay.numeric,
            network: wallet.network,
          }),
        );
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "set_policy_limits failed unexpectedly.",
        );
      }
    },
  );
}
