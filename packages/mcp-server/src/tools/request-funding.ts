import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { formatFundingInstructions } from "../lib/format-output.js";
import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerRequestFundingTool(server: McpServer): void {
  server.registerTool(
    "request_funding",
    {
      description:
        "Return Friendbot / Stellar Lab links to fund the agent wallet on testnet, or instructions for mainnet.",
    },
    async () => {
      const wallet = loadWalletFromEnv();
      if (!wallet.ok) {
        return errorToolResult(wallet.error);
      }

      return textToolResult(
        formatFundingInstructions(wallet.network, wallet.keypair.publicKey()),
      );
    },
  );
}
