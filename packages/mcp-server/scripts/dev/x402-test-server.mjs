/**
 * Minimal x402-gated API for local testing.
 *
 * Usage:
 *   PAY_TO=G...your_address node scripts/dev/x402-test-server.mjs
 *
 * Then in Claude Code:
 *   Use x402_fetch from Nebula with url http://localhost:3001/my-service
 *
 * Requires: @x402/express (dev dependency) — install with:
 *   pnpm add -D @x402/express
 */
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

const PORT = Number(process.env.PORT ?? 3001);
const ROUTE = "/my-service";
const PAY_TO = process.env.PAY_TO?.trim();
const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL?.trim() ?? "https://www.x402.org/facilitator";

if (!PAY_TO) {
  console.error("Set PAY_TO to your Stellar testnet public key (G...).");
  process.exit(1);
}

const app = express();

app.get("/", (_req, res) => {
  res.json({
    route: ROUTE,
    price: "$0.01",
    network: "stellar:testnet",
    payTo: PAY_TO,
    facilitator: FACILITATOR_URL,
  });
});

app.use(
  paymentMiddlewareFromConfig(
    {
      [`GET ${ROUTE}`]: {
        accepts: {
          scheme: "exact",
          price: "$0.01",
          network: "stellar:testnet",
          payTo: PAY_TO,
        },
      },
    },
    new HTTPFacilitatorClient({ url: FACILITATOR_URL }),
    [{ network: "stellar:testnet", server: new ExactStellarScheme() }],
  ),
);

app.get(ROUTE, (_req, res) => {
  res.json({ secret: "valuable content", paid: true });
});

app.listen(PORT, () => {
  console.log(`x402 test server: http://localhost:${PORT}${ROUTE}`);
  console.log(`PAY_TO=${PAY_TO}`);
  console.log(`Facilitator: ${FACILITATOR_URL}`);
});
