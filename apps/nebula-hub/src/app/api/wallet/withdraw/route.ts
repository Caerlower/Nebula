import { NextRequest } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";

import { isDashboardAuth, resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { privyConfigured } from "@/lib/auth";
import {
  buildPaymentXdr,
  explorerTxUrl,
  hasUsdcTrustline,
  signAndSubmitWithPrivy,
} from "@/lib/stellar";
import { fetchUsdcBalance } from "@/lib/x402/fetch";

/**
 * Dashboard-only wallet withdraw: XLM or Circle USDC to an external G… address.
 * Signed by Privy — not exposed as an MCP tool (agents use `transfer` for XLM).
 */
export async function POST(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();
  if (!isDashboardAuth(principal)) {
    return Response.json(
      { status: "error", reason: "dashboard_only" },
      { status: 403 },
    );
  }

  if (!principal.stellarAddress || !principal.privyWalletId) {
    return Response.json(
      { status: "error", reason: "wallet_not_provisioned" },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    asset?: string;
    destination?: string;
    amount?: number;
    memo?: string;
  };

  const asset = body.asset === "USDC" ? "USDC" : "XLM";
  const destination = body.destination?.trim() ?? "";
  const amount = Number(body.amount);
  const memo = body.memo?.trim().slice(0, 28) || undefined;

  if (!StrKey.isValidEd25519PublicKey(destination)) {
    return Response.json(
      { status: "error", reason: "invalid_destination" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json(
      { status: "error", reason: "invalid_amount" },
      { status: 400 },
    );
  }

  const network =
    (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
    "testnet";

  if (asset === "USDC") {
    const ready = await hasUsdcTrustline(principal.stellarAddress, network);
    if (!ready) {
      return Response.json(
        {
          status: "error",
          reason:
            "usdc_trustline_missing — open a Circle USDC trustline on Connect first",
        },
        { status: 400 },
      );
    }
    const bal = await fetchUsdcBalance(principal.stellarAddress, network);
    if (amount > bal + 1e-7) {
      return Response.json(
        {
          status: "error",
          reason: `insufficient_usdc: need ${amount}, have ${bal}`,
        },
        { status: 400 },
      );
    }
  }

  if (!privyConfigured() && principal.privyWalletId === "dev-wallet") {
    const fakeHash = `dev_${Date.now().toString(16)}`;
    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        type: "transfer",
        destination,
        amountXlm: amount,
        memo,
        reason: `user_requested; asset=${asset}; dashboard_withdraw`,
        txHash: fakeHash,
        status: "confirmed",
      },
    });
    return Response.json({
      status: "ok",
      tx_hash: fakeHash,
      asset,
      explorer_url: explorerTxUrl(network, fakeHash),
      message: "Dev dry-run withdraw (no Privy).",
    });
  }

  try {
    const { unsignedXdr, hashHex } = await buildPaymentXdr({
      source: principal.stellarAddress,
      destination,
      amount,
      asset: asset === "USDC" ? "USDC" : "native",
      memo,
      network,
    });

    const txHash = await signAndSubmitWithPrivy({
      unsignedXdr,
      hashHex,
      walletId: principal.privyWalletId,
      sourceAddress: principal.stellarAddress,
      network,
    });

    await prisma.transaction.create({
      data: {
        userId: principal.userId,
        type: "transfer",
        destination,
        amountXlm: amount,
        memo,
        reason: `user_requested; asset=${asset}; dashboard_withdraw`,
        txHash,
        status: "confirmed",
      },
    });

    return Response.json({
      status: "ok",
      tx_hash: txHash,
      asset,
      explorer_url: explorerTxUrl(network, txHash),
      message: `Sent ${amount} ${asset}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "withdraw_failed";
    return Response.json(
      { status: "error", reason: message },
      { status: 500 },
    );
  }
}
