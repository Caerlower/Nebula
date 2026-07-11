import { x402HTTPClient } from "@x402/core/client";
import type { PaymentPayload } from "@x402/core/types";
import { Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { getNetworkPassphrase } from "@x402/stellar";

import { loadWalletFromEnv } from "../wallet.js";
import { getNetworkConfig } from "../config.js";
import { field, formatNetworkHeader, formatTxReference, section } from "../lib/format-output.js";
import { paymentRequirementsToUsdc } from "./amount.js";
import { createX402PaymentClient, recordX402Payment } from "./client.js";
import { getX402Network } from "./network.js";

export interface X402FetchSuccess {
  ok: true;
  status: number;
  paid: boolean;
  amountUsdc?: number;
  settlementTx?: string;
  contentType: string;
  body: string;
}

export interface X402FetchFailure {
  ok: false;
  error: string;
}

export type X402FetchResult = X402FetchSuccess | X402FetchFailure;

async function readResponseBody(response: Response): Promise<{
  contentType: string;
  body: string;
}> {
  const contentType = response.headers.get("content-type") ?? "text/plain";

  if (contentType.includes("application/json")) {
    try {
      const json = await response.json();
      return { contentType, body: JSON.stringify(json, null, 2) };
    } catch {
      return { contentType, body: await response.text() };
    }
  }

  return { contentType, body: await response.text() };
}

function applyTestnetFeeFix(
  paymentPayload: PaymentPayload,
  network: ReturnType<typeof getX402Network>,
): PaymentPayload {
  if (network !== "stellar:testnet") {
    return paymentPayload;
  }

  if (
    paymentPayload.x402Version !== 2 ||
    !paymentPayload.payload ||
    typeof paymentPayload.payload !== "object" ||
    !("transaction" in paymentPayload.payload) ||
    typeof paymentPayload.payload.transaction !== "string"
  ) {
    return paymentPayload;
  }

  try {
    const networkPassphrase = getNetworkPassphrase(network);
    const tx = new Transaction(
      paymentPayload.payload.transaction,
      networkPassphrase,
    );
    const sorobanData = tx.toEnvelope().v1()?.tx()?.ext()?.sorobanData();
    if (!sorobanData) {
      return paymentPayload;
    }

    return {
      ...paymentPayload,
      payload: {
        ...paymentPayload.payload,
        transaction: TransactionBuilder.cloneFrom(tx, {
          fee: "1",
          sorobanData,
          networkPassphrase,
        })
          .build()
          .toXDR(),
      },
    };
  } catch {
    return paymentPayload;
  }
}

export async function x402Fetch(url: string): Promise<X402FetchResult> {
  const wallet = loadWalletFromEnv();
  if (!wallet.ok) {
    return { ok: false, error: wallet.error };
  }

  let initialResponse: Response;
  try {
    initialResponse = await fetch(url, { method: "GET" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    return { ok: false, error: `Request to ${url} failed: ${message}` };
  }

  if (initialResponse.status !== 402) {
    const { contentType, body } = await readResponseBody(initialResponse);
    if (!initialResponse.ok) {
      return {
        ok: false,
        error: `Request returned HTTP ${initialResponse.status}.\n\n${body}`,
      };
    }

    return {
      ok: true,
      status: initialResponse.status,
      paid: false,
      contentType,
      body,
    };
  }

  const client = createX402PaymentClient(wallet.keypair, wallet.network);
  const httpClient = new x402HTTPClient(client);
  const network = getX402Network();

  let paymentRequired;
  try {
    let body: unknown;
    try {
      const text = await initialResponse.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Body is optional for v2 PAYMENT-REQUIRED header parsing.
    }

    paymentRequired = httpClient.getPaymentRequiredResponse(
      (name) => initialResponse.headers.get(name),
      body,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid 402 response";
    return {
      ok: false,
      error: `Received HTTP 402 but could not parse payment requirements: ${message}`,
    };
  }

  const previewRequirements =
    paymentRequired.accepts.find((req) => req.network.startsWith("stellar:")) ??
    paymentRequired.accepts[0];

  if (!previewRequirements) {
    return {
      ok: false,
      error: "402 response did not include any payment options.",
    };
  }

  let paymentPayload: PaymentPayload;
  try {
    paymentPayload = await client.createPaymentPayload(paymentRequired);
    paymentPayload = applyTestnetFeeFix(paymentPayload, network);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Payment signing failed";
    return {
      ok: false,
      error: `Payment blocked or failed before submission: ${message}`,
    };
  }

  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

  let paidResponse: Response;
  try {
    paidResponse = await fetch(url, {
      method: "GET",
      headers: {
        ...paymentHeaders,
        "Access-Control-Expose-Headers":
          "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    return {
      ok: false,
      error: `Paid retry to ${url} failed: ${message}`,
    };
  }

  const requirements =
    paymentPayload.x402Version === 2 && paymentPayload.accepted
      ? paymentPayload.accepted
      : previewRequirements;

  let settlementTx: string | undefined;
  try {
    const settlement = httpClient.getPaymentSettleResponse((name) =>
      paidResponse.headers.get(name),
    );
    if (settlement.success && settlement.transaction) {
      settlementTx = settlement.transaction;
    }
  } catch {
    // Settlement header may be absent on some servers.
  }

  const amountUsdc = paymentRequirementsToUsdc(requirements);

  if (paidResponse.ok) {
    const recorded = await recordX402Payment(
      wallet.keypair,
      wallet.network,
      requirements,
    );
    if (!recorded.ok) {
      return {
        ok: false,
        error: `Payment succeeded but spending record failed: ${recorded.error}`,
      };
    }

    const { contentType, body } = await readResponseBody(paidResponse);

    return {
      ok: true,
      status: paidResponse.status,
      paid: true,
      amountUsdc,
      settlementTx,
      contentType,
      body,
    };
  }

  const { body } = await readResponseBody(paidResponse);

  if (paidResponse.status === 402) {
    return {
      ok: false,
      error:
        `Payment was signed (${amountUsdc} USDC) but the server still returned 402.\n` +
        `Settlement may have failed. Response body:\n\n${body}`,
    };
  }

  return {
    ok: false,
    error:
      `Paid request failed with HTTP ${paidResponse.status} ` +
      `after signing ${amountUsdc} USDC.\n\n${body}`,
  };
}

export function formatX402FetchResult(result: X402FetchSuccess): string {
  const network = getNetworkConfig().name;
  const lines = [
    ...formatNetworkHeader(network, "x402 fetch"),
    field("Status", `HTTP ${result.status}`),
    field(
      "Payment",
      result.paid
        ? `${result.amountUsdc} USDC via x402 (Stellar)`
        : "none (resource was not gated)",
    ),
  ];

  if (result.settlementTx) {
    lines.push(...formatTxReference(network, result.settlementTx, "Settlement"));
  }

  lines.push(section("Response body"), result.body);
  return lines.join("\n");
}
