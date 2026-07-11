import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";

import { checkAgentSpend } from "../policy/spending.js";
import { createMppChannelClient } from "../mpp/client.js";
import { deployPaymentChannel } from "../mpp/deploy.js";
import { loadMppNetwork } from "../mpp/network.js";
import {
  formatMppSessionStatus,
  generateCommitmentKeypair,
  getActiveMppSession,
  setActiveMppSession,
  type MppSession,
} from "../mpp/session.js";
import { formatNetworkHeader } from "../lib/format-output.js";
import { toUsdcAmount } from "../utils/amount.js";
import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

function parseRecipient(
  recipient: string | undefined,
): { ok: true; address: string } | { ok: false; error: string } {
  const value = recipient?.trim() || process.env.MPP_RECIPIENT?.trim();
  if (!value) {
    return {
      ok: false,
      error:
        "Recipient is required. Pass recipient (G...) or set MPP_RECIPIENT in the MCP environment.",
    };
  }

  if (!StrKey.isValidEd25519PublicKey(value)) {
    return {
      ok: false,
      error: `Invalid recipient "${value}". Expected a Stellar public key (G...).`,
    };
  }

  return { ok: true, address: value };
}

export function registerMppOpenSessionTool(server: McpServer): void {
  server.registerTool(
    "mpp_open_session",
    {
      description:
        "Open an MPP payment-channel session with a USDC budget. Deploys a one-way-channel Soroban contract (bundled WASM), deposits the budget on-chain once, and reserves the amount against spending limits.",
      inputSchema: {
        budget: z
          .string()
          .describe("Total session budget in USDC (e.g. 1.0). Counts against MAX_PER_CALL and MAX_PER_DAY."),
        recipient: z
          .string()
          .optional()
          .describe("Recipient G... address (channel payout). Defaults to MPP_RECIPIENT env."),
      },
    },
    async ({ budget, recipient }) => {
      try {
        if (getActiveMppSession()) {
          return errorToolResult(
            "An MPP session is already open. Call mpp_close_session before opening a new one.",
          );
        }

        const wallet = loadWalletFromEnv();
        if (!wallet.ok) {
          return errorToolResult(wallet.error);
        }

        const network = loadMppNetwork();
        if (!network.ok) {
          return errorToolResult(network.error);
        }

        const recipientParsed = parseRecipient(recipient);
        if (!recipientParsed.ok) {
          return errorToolResult(recipientParsed.error);
        }

        const budgetNumeric = Number(budget);
        if (!Number.isFinite(budgetNumeric) || budgetNumeric <= 0) {
          return errorToolResult("budget must be a positive number.");
        }

        const limitCheck = await checkAgentSpend(
          wallet.keypair,
          wallet.network,
          budgetNumeric,
        );
        if (!limitCheck.ok) {
          return errorToolResult(
            "reason" in limitCheck ? limitCheck.reason : limitCheck.error,
          );
        }

        const { secretHex, pubkeyHex } = generateCommitmentKeypair();
        const budgetStroops = toUsdcAmount(budgetNumeric);

        const deployed = await deployPaymentChannel({
          keypair: wallet.keypair,
          network: wallet.network,
          networkId: network.networkId,
          recipient: recipientParsed.address,
          budgetStroops,
          commitmentPubkeyHex: pubkeyHex,
        });

        if (!deployed.ok) {
          return errorToolResult(deployed.error);
        }

        const session = {
          channel: deployed.contractId,
          recipient: recipientParsed.address,
          budgetUsdc: budgetNumeric,
          budgetStroops,
          cumulativeStroops: 0n,
          commitmentSecretHex: secretHex,
          commitmentPubkeyHex: pubkeyHex,
          openedAt: new Date().toISOString(),
          networkId: network.networkId,
        } as MppSession;

        session.mppx = createMppChannelClient({
          commitmentSecretHex: secretHex,
          channel: deployed.contractId,
          networkId: network.networkId,
          budgetStroops,
          session,
          keypair: wallet.keypair,
          network: wallet.network,
        });

        setActiveMppSession(session);

        return textToolResult(
          [
            ...formatNetworkHeader(wallet.network.name, "MPP session opened"),
            formatMppSessionStatus(session, wallet.network.name),
          ].join("\n"),
        );
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "mpp_open_session failed unexpectedly.",
        );
      }
    },
  );
}
