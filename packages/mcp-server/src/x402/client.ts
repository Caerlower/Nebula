import { x402Client } from "@x402/core/client";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import type { Keypair } from "@stellar/stellar-sdk";
import type { PaymentRequirements } from "@x402/core/types";
import { checkAgentSpend, recordAgentSpend } from "../policy/spending.js";
import { paymentRequirementsToUsdc } from "./amount.js";
import { getX402Network } from "./network.js";
import type { NetworkConfig } from "../config.js";

const STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";

export function createX402PaymentClient(
  keypair: Keypair,
  walletNetwork: NetworkConfig,
): x402Client {
  const x402Network = getX402Network();
  const signer = createEd25519Signer(keypair.secret(), x402Network);
  const rpcConfig =
    x402Network === "stellar:testnet" ? { url: STELLAR_RPC_URL } : undefined;

  const client = new x402Client()
    .register("stellar:*", new ExactStellarScheme(signer, rpcConfig))
    .registerPolicy((_version, requirements) =>
      requirements.filter((req) => req.network.startsWith("stellar:")),
    )
    .onBeforePaymentCreation(async ({ selectedRequirements }) => {
      const amountUsdc = paymentRequirementsToUsdc(selectedRequirements);

      const check = await checkAgentSpend(keypair, walletNetwork, amountUsdc);
      if (!check.ok) {
        return {
          abort: true,
          reason: "reason" in check ? check.reason : check.error,
        };
      }

      return undefined;
    });

  return client;
}

export async function recordX402Payment(
  keypair: Keypair,
  network: NetworkConfig,
  requirements: PaymentRequirements,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const amountUsdc = paymentRequirementsToUsdc(requirements);
  return recordAgentSpend(keypair, network, amountUsdc, "USDC");
}
