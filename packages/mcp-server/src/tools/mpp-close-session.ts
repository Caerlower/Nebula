import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { closeMppChannel } from "../mpp/close.js";
import {
  clearActiveMppSession,
  requireActiveMppSession,
} from "../mpp/session.js";
import {
  field,
  formatContractReference,
  formatNetworkHeader,
  formatTxReference,
  section,
} from "../lib/format-output.js";
import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerMppCloseSessionTool(server: McpServer): void {
  server.registerTool(
    "mpp_close_session",
    {
      description:
        "Settle the active MPP session on-chain via channel close(), transfer committed USDC to the recipient, and refund any unused deposit.",
      inputSchema: {},
    },
    async () => {
      try {
        const sessionState = requireActiveMppSession();
        if (!sessionState.ok) {
          return errorToolResult(sessionState.error);
        }

        const wallet = loadWalletFromEnv();
        if (!wallet.ok) {
          return errorToolResult(wallet.error);
        }

        const { session } = sessionState;
        const closed = await closeMppChannel({
          channel: session.channel,
          commitmentSecretHex: session.commitmentSecretHex,
          feePayer: wallet.keypair,
          networkId: session.networkId,
          amountStroops: session.cumulativeStroops,
        });

        if (!closed.ok) {
          return errorToolResult(closed.error);
        }

        const settledUsdc = Number(closed.settledStroops) / 10_000_000;
        const refundedUsdc = Math.max(session.budgetUsdc - settledUsdc, 0);

        clearActiveMppSession();

        return textToolResult(
          [
            ...formatNetworkHeader(wallet.network.name, "MPP session closed"),
            ...formatContractReference(
              wallet.network.name,
              session.channel,
              "Channel",
            ),
            section("Settlement"),
            field(
              "Paid to recipient",
              `${settledUsdc.toFixed(7).replace(/\.?0+$/, "")} USDC`,
            ),
            field(
              "Refunded to funder",
              `${refundedUsdc.toFixed(7).replace(/\.?0+$/, "")} USDC`,
            ),
            ...formatTxReference(wallet.network.name, closed.txHash, "Close"),
          ].join("\n"),
        );
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "mpp_close_session failed unexpectedly.",
        );
      }
    },
  );
}
