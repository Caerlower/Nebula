/**
 * Local MPP channel server for testing mpp_open_session → mpp_fetch → mpp_close_session.
 *
 * Usage (after mpp_open_session prints channel + commitment pubkey):
 *   CHANNEL_CONTRACT=C... \
 *   COMMITMENT_PUBKEY=<64-hex> \
 *   node scripts/mpp-channel-test-server.mjs
 *
 * Optional:
 *   PRICE=0.1          — per-request price in USDC (default 0.1)
 *   PORT=3003
 *   MPP_SECRET_KEY=... — credential signing secret (min 32 bytes; optional for local test)
 */
import express from "express";
import { StrKey } from "@stellar/stellar-sdk";
import { Mppx, Store } from "mppx/server";
import { stellar } from "@stellar/mpp/channel/server";

const PORT = Number(process.env.PORT ?? 3003);
const CHANNEL_CONTRACT = process.env.CHANNEL_CONTRACT?.trim();
const COMMITMENT_PUBKEY = process.env.COMMITMENT_PUBKEY?.trim();
const PRICE = process.env.PRICE?.trim() ?? "0.1";
// mppx requires secretKey >= 32 bytes (local test default only).
const MPP_SECRET_KEY =
  process.env.MPP_SECRET_KEY?.trim() ??
  "nebula-mpp-local-test-secret-key-32bytes-min";

if (!CHANNEL_CONTRACT || !COMMITMENT_PUBKEY) {
  console.error(
    "Set CHANNEL_CONTRACT (C...) and COMMITMENT_PUBKEY (64-char hex) from mpp_open_session output.",
  );
  process.exit(1);
}

if (!/^[0-9a-f]{64}$/i.test(COMMITMENT_PUBKEY)) {
  console.error("COMMITMENT_PUBKEY must be 64 hex characters (raw ed25519 public key).");
  process.exit(1);
}

const commitmentPublicKeyG = StrKey.encodeEd25519PublicKey(
  Buffer.from(COMMITMENT_PUBKEY, "hex"),
);

const mppx = Mppx.create({
  secretKey: MPP_SECRET_KEY,
  methods: [
    stellar.channel({
      channel: CHANNEL_CONTRACT,
      commitmentKey: commitmentPublicKeyG,
      store: Store.memory(),
      network: "stellar:testnet",
      recipient: process.env.MPP_RECIPIENT?.trim(),
      currency: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    }),
  ],
});

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, channel: CHANNEL_CONTRACT, price: PRICE });
});

app.use(async (req, res) => {
  const webReq = new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method,
    headers: new Headers(req.headers),
  });

  const result = await mppx.channel({
    amount: PRICE,
    description: "Nebula MPP channel test endpoint",
  })(webReq);

  if (result.status === 402) {
    const challenge = result.challenge;
    res.status(challenge.status);
    challenge.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(await challenge.text());
    return;
  }

  const receipt = result.withReceipt(
    Response.json({
      message: "Paid via MPP channel commitment (off-chain)",
      price: PRICE,
      timestamp: new Date().toISOString(),
    }),
  );

  res.status(receipt.status);
  receipt.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(await receipt.text());
});

app.listen(PORT, () => {
  console.log(`MPP channel test server on http://localhost:${PORT}`);
  console.log(`Channel: ${CHANNEL_CONTRACT}`);
  console.log(`Price per request: ${PRICE} USDC`);
  console.log(`Try: mpp_fetch http://localhost:${PORT}/`);
});
