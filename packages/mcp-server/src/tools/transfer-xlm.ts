import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { formatTransferSuccess } from "../lib/format-output.js";
import { loadWalletFromEnv } from "../wallet.js";
import { submitPayment } from "../transfers.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerTransferXlmTool(server: McpServer): void {
  server.registerTool(
    "transfer_xlm",
    {
      description:
        "Send XLM to a Stellar address on the configured network. Subject to spending limits.",
      inputSchema: {
        destination: z
          .string()
          .describe("Recipient Stellar public address (G...)"),
        amount: z.string().describe("Amount of XLM to send (e.g. 1.5)"),
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
        asset: "XLM",
      });

      if (!result.ok) {
        return errorToolResult(result.error);
      }

      return textToolResult(
        formatTransferSuccess({
          network: wallet.network.name,
          asset: "XLM",
          amount: result.amount,
          destination: result.destination,
          hash: result.hash,
        }),
      );
    },
  );
}
