import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerGetAddressTool(server: McpServer): void {
  server.registerTool(
    "get_address",
    {
      description:
        "Return the public Stellar address (G...) for the configured wallet.",
    },
    async () => {
      const wallet = loadWalletFromEnv();
      if (!wallet.ok) {
        return errorToolResult(wallet.error);
      }

      return textToolResult(
        [
          `Network: ${wallet.network.name}`,
          `Address: ${wallet.keypair.publicKey()}`,
        ].join("\n"),
      );
    },
  );
}
