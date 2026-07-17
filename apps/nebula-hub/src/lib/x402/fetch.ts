import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
} from "@x402/core/http";
import { x402HTTPClient } from "@x402/core/client";
import type { PaymentPayload, PaymentRequired, PaymentRequirements } from "@x402/core/types";
import { Horizon, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { getNetworkPassphrase } from "@x402/stellar";

import type { HashSigner } from "@/lib/signing";

import {
  circleUsdcIssuer,
  createHubX402ClientWithSigner,
  getX402Network,
  payToAddress,
  paymentRequirementsToUsdc,
} from "./protocol";

export type X402FreeResult = {
  kind: "free";
  status: number;
  contentType: string;
  body: string;
};

export type X402Challenge = {
  kind: "challenge";
  amountUsdc: number;
  payTo: string;
  requirements: PaymentRequirements;
  paymentRequired: PaymentRequired;
};

export type X402PaidResult = {
  kind: "paid";
  status: number;
  amountUsdc: number;
  payTo: string;
  settlementTx?: string;
  contentType: string;
  body: string;
};

export type X402Error = {
  kind: "error";
  error: string;
};

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

function parsePaymentRequired(
  response: Response,
  bodyText: string,
): PaymentRequired {
  const header =
    response.headers.get("PAYMENT-REQUIRED") ??
    response.headers.get("payment-required") ??
    response.headers.get("X-PAYMENT-REQUIRED");
  if (header) {
    return decodePaymentRequiredHeader(header);
  }
  if (bodyText) {
    const parsed = JSON.parse(bodyText) as PaymentRequired;
    if (parsed && Array.isArray(parsed.accepts)) {
      return parsed;
    }
  }
  throw new Error("Missing PAYMENT-REQUIRED header and body");
}

function pickStellarRequirements(
  paymentRequired: PaymentRequired,
): PaymentRequirements | null {
  return (
    paymentRequired.accepts.find((req) => req.network.startsWith("stellar:")) ??
    paymentRequired.accepts[0] ??
    null
  );
}

function applyTestnetFeeFix(
  paymentPayload: PaymentPayload,
  network: ReturnType<typeof getX402Network>,
): PaymentPayload {
  if (network !== "stellar:testnet") return paymentPayload;
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
    if (!sorobanData) return paymentPayload;

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

export async function fetchUsdcBalance(
  address: string,
  network: "testnet" | "mainnet",
): Promise<number> {
  const horizon =
    network === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";
  const server = new Horizon.Server(horizon);
  const issuer = circleUsdcIssuer(network);
  try {
    const account = await server.loadAccount(address);
    for (const b of account.balances) {
      if (
        (b.asset_type === "credit_alphanum4" ||
          b.asset_type === "credit_alphanum12") &&
        b.asset_code === "USDC" &&
        b.asset_issuer === issuer
      ) {
        return Number(b.balance);
      }
    }
    return 0;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return 0;
    }
    throw error;
  }
}

/** GET url. Returns free content or a 402 challenge (unsigned). */
export async function probeX402Url(
  url: string,
): Promise<X402FreeResult | X402Challenge | X402Error> {
  let response: Response;
  try {
    response = await fetch(url, { method: "GET" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    return { kind: "error", error: `Request to ${url} failed: ${message}` };
  }

  if (response.status !== 402) {
    const { contentType, body } = await readResponseBody(response);
    if (!response.ok) {
      return {
        kind: "error",
        error: `Request returned HTTP ${response.status}.\n\n${body}`,
      };
    }
    return { kind: "free", status: response.status, contentType, body };
  }

  const bodyText = await response.text();
  let paymentRequired: PaymentRequired;
  try {
    paymentRequired = parsePaymentRequired(response, bodyText);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid 402 response";
    return {
      kind: "error",
      error: `Received HTTP 402 but could not parse payment requirements: ${message}`,
    };
  }

  const requirements = pickStellarRequirements(paymentRequired);
  if (!requirements) {
    return {
      kind: "error",
      error: "402 response did not include any payment options.",
    };
  }

  let amountUsdc: number;
  try {
    amountUsdc = paymentRequirementsToUsdc(requirements);
  } catch (error) {
    return {
      kind: "error",
      error: error instanceof Error ? error.message : "Invalid payment amount",
    };
  }

  const payTo = payToAddress(requirements);
  if (!payTo) {
    return {
      kind: "error",
      error: "402 challenge is missing a Stellar payTo (G…) address.",
    };
  }

  return {
    kind: "challenge",
    amountUsdc,
    payTo,
    requirements,
    paymentRequired,
  };
}

/** Sign the challenge and retry the GET with payment headers. */
export async function payX402Challenge(params: {
  url: string;
  signer: HashSigner;
  network: "testnet" | "mainnet";
  /** Fresh challenge preferred; if omitted, re-probes the URL. */
  paymentRequired?: PaymentRequired;
}): Promise<X402PaidResult | X402FreeResult | X402Error> {
  let paymentRequired = params.paymentRequired;
  if (!paymentRequired) {
    const probe = await probeX402Url(params.url);
    if (probe.kind === "free") return probe;
    if (probe.kind === "error") return probe;
    paymentRequired = probe.paymentRequired;
  }

  const client = createHubX402ClientWithSigner({
    signer: params.signer,
    network: params.network,
  });
  const httpClient = new x402HTTPClient(client);
  const network = getX402Network(params.network);

  let paymentPayload: PaymentPayload;
  try {
    paymentPayload = await client.createPaymentPayload(paymentRequired);
    paymentPayload = applyTestnetFeeFix(paymentPayload, network);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Payment signing failed";
    return { kind: "error", error: `Payment blocked or failed: ${message}` };
  }

  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

  let paidResponse: Response;
  try {
    paidResponse = await fetch(params.url, {
      method: "GET",
      headers: {
        ...paymentHeaders,
        "Access-Control-Expose-Headers": "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    return {
      kind: "error",
      error: `Paid retry to ${params.url} failed: ${message}`,
    };
  }

  const requirements =
    paymentPayload.x402Version === 2 && paymentPayload.accepted
      ? paymentPayload.accepted
      : (pickStellarRequirements(paymentRequired) as PaymentRequirements);

  let settlementTx: string | undefined;
  try {
    const settleHeader =
      paidResponse.headers.get("PAYMENT-RESPONSE") ??
      paidResponse.headers.get("payment-response") ??
      paidResponse.headers.get("X-PAYMENT-RESPONSE");
    if (settleHeader) {
      const settlement = decodePaymentResponseHeader(settleHeader);
      if (settlement.success && settlement.transaction) {
        settlementTx = settlement.transaction;
      }
    }
  } catch {
    // optional
  }

  const amountUsdc = paymentRequirementsToUsdc(requirements);
  const payTo = payToAddress(requirements) ?? "";

  if (paidResponse.ok) {
    const { contentType, body } = await readResponseBody(paidResponse);
    return {
      kind: "paid",
      status: paidResponse.status,
      amountUsdc,
      payTo,
      settlementTx,
      contentType,
      body,
    };
  }

  const { body } = await readResponseBody(paidResponse);
  if (paidResponse.status === 402) {
    return {
      kind: "error",
      error:
        `Payment was signed (${amountUsdc} USDC) but the server still returned 402.\n` +
        `Settlement may have failed. Response body:\n\n${body}`,
    };
  }

  return {
    kind: "error",
    error:
      `Paid request failed with HTTP ${paidResponse.status} ` +
      `after signing ${amountUsdc} USDC.\n\n${body}`,
  };
}
