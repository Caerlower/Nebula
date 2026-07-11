import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createClients,
  wrapBasicSigner,
  MAINNET_CONFIG,
  TESTNET_CONFIG,
  formatSorobanError,
} from "@trionlabs/stellar8004";
import { Keypair } from "@stellar/stellar-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
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

const keypair = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY);
const publicKey = keypair.publicKey();

for (const [label, config] of [
  ["testnet", TESTNET_CONFIG],
  ["mainnet", MAINNET_CONFIG],
]) {
  const signer = wrapBasicSigner(keypair, config.networkPassphrase);
  const { identity } = createClients(config, signer);

  console.log(`=== ${label.toUpperCase()} ===`);
  console.log("identity contract:", config.contracts.identity);
  console.log("Nebula wallet:", publicKey);

  try {
    const ownerTx = await identity.find_owner({ agent_id: 10 });
    await ownerTx.simulate();
    console.log("agent 10 owner:", ownerTx.result);

    const balanceTx = await identity.balance({ account: publicKey });
    await balanceTx.simulate();
    console.log("Nebula wallet NFT balance:", balanceTx.result);
  } catch (e) {
    console.log("error:", formatSorobanError(e));
  }
  console.log("");
}

console.log("User-linked mainnet account: GDDTQFQZK734EXIJE5LWU4G4YC5A6P5AHJ4UWVMV6WBFWT6BAAQQHV2V");
