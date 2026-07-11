import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { formatPolicyStatus } from "../policy/format.js";
import { readPolicyStatus } from "../policy/status.js";
import { loadPolicyContractId } from "../policy/config.js";
import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerGetPolicyStatusTool(server: McpServer): void {
  server.registerTool(
    "get_policy_status",
    {
      description:
        "Read on-chain spending policy limits and rolling-window usage from the Nebula policy Soroban contract (POLICY_CONTRACT_ID).",
      inputSchema: {},
    },
    async () => {
      try {
        const contract = loadPolicyContractId();
        if (!contract.ok) {
          return errorToolResult(contract.error);
        }

        const wallet = loadWalletFromEnv();
        if (!wallet.ok) {
          return errorToolResult(wallet.error);
        }

        const result = await readPolicyStatus(
          wallet.keypair,
          wallet.network,
          contract.contractId,
        );
        if (!result.ok) {
          return errorToolResult(result.error);
        }

        return textToolResult(
          formatPolicyStatus(result.status, wallet.network),
        );
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "get_policy_status failed unexpectedly.",
        );
      }
    },
  );
}
