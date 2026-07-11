import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { formatRegisterIdentityResult } from "../8004/format.js";
import { registerAgentIdentity } from "../8004/identity.js";
import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerRegisterIdentityTool(server: McpServer): void {
  server.registerTool(
    "register_identity",
    {
      description:
        "Register this Nebula agent's Stellar wallet as an ERC-8004 on-chain identity (Stellar8004). Returns agent ID and testnet/mainnet explorer links. Safe to call if already registered.",
      inputSchema: {},
    },
    async () => {
      try {
        const wallet = loadWalletFromEnv();
        if (!wallet.ok) {
          return errorToolResult(wallet.error);
        }

        const result = await registerAgentIdentity(
          wallet.keypair,
          wallet.network,
        );

        if (!result.ok) {
          return errorToolResult(result.error);
        }

        return textToolResult(
          formatRegisterIdentityResult(result, wallet.network),
        );
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "register_identity failed unexpectedly.",
        );
      }
    },
  );
}
