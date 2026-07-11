import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { isPolicyEnabled } from "../policy/config.js";
import { formatPolicyStatus } from "../policy/format.js";
import { readPolicyStatus } from "../policy/status.js";
import {
  formatSpendingReport,
  loadSpendingLimitsConfig,
  spendingLimitEngine,
} from "../spending-limits.js";
import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerSpendingReportTool(server: McpServer): void {
  server.registerTool(
    "spending_report",
    {
      description:
        "Show per-call limit, daily limit, spent in the rolling 24h window, and remaining budget. Uses on-chain policy when POLICY_CONTRACT_ID is set.",
    },
    async () => {
      if (isPolicyEnabled()) {
        const wallet = loadWalletFromEnv();
        if (!wallet.ok) {
          return errorToolResult(wallet.error);
        }

        const status = await readPolicyStatus(wallet.keypair, wallet.network);
        if (!status.ok) {
          return errorToolResult(status.error);
        }

        return textToolResult(
          formatPolicyStatus(status.status, wallet.network),
        );
      }

      const limitsConfig = loadSpendingLimitsConfig();
      if (!limitsConfig.ok) {
        return errorToolResult(limitsConfig.error);
      }

      const report = spendingLimitEngine.getReport(limitsConfig.config);
      const wallet = loadWalletFromEnv();
      const network = wallet.ok ? wallet.network.name : "testnet";
      return textToolResult(formatSpendingReport(report, network));
    },
  );
}
