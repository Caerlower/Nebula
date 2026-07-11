import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { deployAndInitializePolicy } from "../policy/deploy.js";
import { formatDeployPolicyResult } from "../policy/format.js";
import { parsePositiveAmount } from "../utils/amount.js";
import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

function resolveDeployLimits(
  maxPerCall: string | undefined,
  maxPerDay: string | undefined,
):
  | { ok: true; maxPerCall: number; maxPerDay: number }
  | { ok: false; error: string } {
  const perCallRaw = maxPerCall?.trim() || process.env.MAX_PER_CALL?.trim();
  const perDayRaw = maxPerDay?.trim() || process.env.MAX_PER_DAY?.trim();

  if (!perCallRaw || !perDayRaw) {
    return {
      ok: false,
      error:
        "max_per_call and max_per_day are required (or set MAX_PER_CALL and MAX_PER_DAY in the MCP environment).",
    };
  }

  const perCall = parsePositiveAmount(perCallRaw);
  if (!perCall.ok) {
    return perCall;
  }

  const perDay = parsePositiveAmount(perDayRaw);
  if (!perDay.ok) {
    return perDay;
  }

  return {
    ok: true,
    maxPerCall: perCall.numeric,
    maxPerDay: perDay.numeric,
  };
}

export function registerDeployPolicyTool(server: McpServer): void {
  server.registerTool(
    "deploy_policy",
    {
      description:
        "Deploy a new Nebula on-chain spending policy Soroban contract, initialize limits, and return POLICY_CONTRACT_ID for your MCP environment. Uses bundled policy.wasm.",
      inputSchema: {
        max_per_call: z
          .string()
          .optional()
          .describe(
            "Initial per-call limit (defaults to MAX_PER_CALL env, e.g. 10).",
          ),
        max_per_day: z
          .string()
          .optional()
          .describe(
            "Initial daily limit (defaults to MAX_PER_DAY env, e.g. 50).",
          ),
      },
    },
    async ({ max_per_call, max_per_day }) => {
      try {
        const wallet = loadWalletFromEnv();
        if (!wallet.ok) {
          return errorToolResult(wallet.error);
        }

        const limits = resolveDeployLimits(max_per_call, max_per_day);
        if (!limits.ok) {
          return errorToolResult(limits.error);
        }

        const result = await deployAndInitializePolicy({
          keypair: wallet.keypair,
          network: wallet.network,
          maxPerCall: limits.maxPerCall,
          maxPerDay: limits.maxPerDay,
        });
        if (!result.ok) {
          return errorToolResult(result.error);
        }

        return textToolResult(
          formatDeployPolicyResult({
            contractId: result.contractId,
            wasmHash: result.wasmHash,
            owner: result.owner,
            maxPerCall: result.maxPerCall,
            maxPerDay: result.maxPerDay,
            network: wallet.network,
          }),
        );
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "deploy_policy failed unexpectedly.",
        );
      }
    },
  );
}
