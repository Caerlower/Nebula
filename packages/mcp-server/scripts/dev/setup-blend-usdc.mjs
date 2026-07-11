/**
 * One-time setup: add Blend USDC trustline and swap XLM → Blend USDC on testnet.
 *
 * Usage (from packages/mcp-server):
 *   node scripts/setup-blend-usdc.mjs [amount]
 *
 * Requires STELLAR_SECRET_KEY in .env and XLM balance for fees + swap.
 */
import { readFileSync } from "fs";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const BLEND_USDC_ISSUER =
  "GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56";
const SWAP_AMOUNT = process.argv[2] ?? "20";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const keypair = Keypair.fromSecret(env.STELLAR_SECRET_KEY);
const server = new Horizon.Server("https://horizon-testnet.stellar.org");
const blendUsdc = new Asset("USDC", BLEND_USDC_ISSUER);
const publicKey = keypair.publicKey();

console.log("Address:", publicKey);

let account = await server.loadAccount(publicKey);
const hasTrust = account.balances.some(
  (b) => b.asset_code === "USDC" && b.asset_issuer === BLEND_USDC_ISSUER,
);

if (!hasTrust) {
  const trustTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: blendUsdc, limit: "1000000" }))
    .setTimeout(30)
    .build();
  trustTx.sign(keypair);
  const trustResult = await server.submitTransaction(trustTx);
  console.log("Blend USDC trustline added:", trustResult.hash);
  account = await server.loadAccount(publicKey);
} else {
  console.log("Blend USDC trustline already exists");
}

// SDK v16 signature: strictReceivePaths(sourceAccount, destAsset, destAmount)
let paths;
try {
  paths = await server
    .strictReceivePaths(publicKey, blendUsdc, SWAP_AMOUNT)
    .call();
} catch (error) {
  console.error(
    "Path lookup failed:",
    error.response?.data?.detail ?? error.message,
  );
  process.exit(1);
}

if (paths.records.length === 0) {
  console.log("");
  console.log("No DEX path found for XLM → Blend USDC on testnet.");
  console.log("The testnet order book has very thin liquidity right now.");
  console.log("");
  console.log("Alternatives to get Blend USDC:");
  console.log("  1. Supply USDC on https://testnet.blend.capital (TestnetV2 pool)");
  console.log("  2. Ask in Stellar / Blend Discord for testnet GATAL USDC");
  console.log("  3. Wait and retry this script later");
  console.log("");
  console.log("Your Blend USDC trustline is ready. Circle USDC (GBBD issuer)");
  console.log("cannot be used in Blend — you need GATAL issuer USDC.");
  process.exit(0);
}

const best = paths.records[0];
console.log(
  `Swapping ~${best.source_amount} XLM for ${SWAP_AMOUNT} Blend USDC...`,
);

const swapTx = new TransactionBuilder(account, {
  fee: String(Number(BASE_FEE) * 10),
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(),
      sendMax: String(Math.ceil(Number(best.source_amount) * 1.1)),
      destAsset: blendUsdc,
      destAmount: SWAP_AMOUNT,
      destination: publicKey,
      path: best.path.map((p) =>
        p.asset_type === "native"
          ? Asset.native()
          : new Asset(p.asset_code, p.asset_issuer),
      ),
    }),
  )
  .setTimeout(30)
  .build();

swapTx.sign(keypair);
const swapResult = await server.submitTransaction(swapTx);
console.log("Swap success:", swapResult.hash);

const updated = await server.loadAccount(publicKey);
for (const balance of updated.balances) {
  if (balance.asset_type === "native") {
    console.log("XLM:", balance.balance);
  } else if (balance.asset_code === "USDC") {
    console.log(
      `USDC (${balance.asset_issuer.slice(0, 8)}...):`,
      balance.balance,
    );
  }
}

console.log("\nDone. Rebuild MCP server and run optimize_treasury in Claude.");
