import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { formatWalletBlock, section } from "../lib/format-output.js";
import {
  fetchAccountBalances,
  formatBalances,
  loadWalletFromEnv,
  unfundedAccountMessage,
} from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerCheckBalanceTool(server: McpServer): void {
  server.registerTool(
    "check_balance",
    {
      description:
        "Return XLM and asset balances for the configured Stellar wallet on the selected network.",
    },
    async () => {
      const wallet = loadWalletFromEnv();
      if (!wallet.ok) {
        return errorToolResult(wallet.error);
      }

      const publicKey = wallet.keypair.publicKey();
      const result = await fetchAccountBalances(publicKey, wallet.network);

      if (!result.ok && result.notFound) {
        return textToolResult(
          unfundedAccountMessage(publicKey, wallet.network),
        );
      }

      if (!result.ok) {
        return errorToolResult(
          `Failed to fetch balances from Horizon: ${result.error}`,
        );
      }

      return textToolResult(
        [
          ...formatWalletBlock(wallet.network.name, publicKey),
          section("Balances"),
          formatBalances(result.balances),
        ].join("\n"),
      );
    },
  );
}
