import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMetadataJson,
  createClients,
  wrapBasicSigner,
  TESTNET_CONFIG,
  formatSorobanError,
} from "@trionlabs/stellar8004";
import { DataUriStorage } from "@trionlabs/stellar8004/storage/data-uri";
import { Keypair } from "@stellar/stellar-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
try {
  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

const keypair = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY);
const publicKey = keypair.publicKey();
const signer = wrapBasicSigner(keypair, TESTNET_CONFIG.networkPassphrase);
const { identity } = createClients(TESTNET_CONFIG, signer);

console.log("Wallet:", publicKey);

try {
  const balanceTx = await identity.balance({ account: publicKey });
  await balanceTx.simulate();
  console.log("balance:", balanceTx.result);

  const totalTx = await identity.total_agents();
  await totalTx.simulate();
  console.log("total_agents:", totalTx.result);
} catch (e) {
  console.error("read failed:", formatSorobanError(e));
}

try {
  const storage = new DataUriStorage();
  const metadata = buildMetadataJson({
    name: "Nebula Agent Test",
    description: "test",
    imageUrl: "",
    services: [],
    supportedTrust: ["reputation"],
    x402Enabled: true,
  });
  const agentUri = await storage.upload(metadata);
  console.log("metadata uri length:", agentUri.length);

  const tx = await identity.register_with_uri({
    caller: publicKey,
    agent_uri: agentUri,
  });
  const sent = await tx.signAndSend();
  console.log("registered agent id:", sent.result);
  console.log("tx hash:", sent.sendTransactionResponse?.hash);
} catch (e) {
  console.error("register failed:", formatSorobanError(e));
}
