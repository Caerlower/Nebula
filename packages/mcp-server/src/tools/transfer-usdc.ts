import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { formatTransferSuccess } from "../lib/format-output.js";
import { submitPayment } from "../transfers.js";
import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerTransferUsdcTool(server: McpServer): void {
  server.registerTool(
    "transfer_usdc",
    {
      description:
        "Send testnet USDC to a Stellar address. Requires a USDC trustline. Subject to spending limits.",
      inputSchema: {
        destination: z
          .string()
          .describe("Recipient Stellar public address (G...)"),
        amount: z.string().describe("Amount of USDC to send (e.g. 0.50)"),
      },
    },
    async ({ destination, amount }) => {
      const wallet = loadWalletFromEnv();
      if (!wallet.ok) {
        return errorToolResult(wallet.error);
      }

      const result = await submitPayment({
        keypair: wallet.keypair,
        network: wallet.network,
        destination,
        amount,
        asset: "USDC",
      });

      if (!result.ok) {
        return errorToolResult(result.error);
      }

      return textToolResult(
        formatTransferSuccess({
          network: wallet.network.name,
          asset: "USDC",
          amount: result.amount,
          destination: result.destination,
          hash: result.hash,
        }),
      );
    },
  );
}
