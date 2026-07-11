import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@stellar/stellar-sdk";
import { registerAgentIdentity } from "../dist/8004/identity.js";
import { getMyReputation } from "../dist/8004/reputation.js";
import { getNetworkConfig } from "../dist/config.js";

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
} catch {
  // optional .env
}

const secret = process.env.STELLAR_SECRET_KEY;
if (!secret) {
  console.error("STELLAR_SECRET_KEY not set");
  process.exit(1);
}

const keypair = Keypair.fromSecret(secret);
const network = getNetworkConfig();

console.log("Wallet:", keypair.publicKey());
console.log("Network:", network.name);

const result = await registerAgentIdentity(keypair, network);
console.log(JSON.stringify(result, null, 2));

const rep = await getMyReputation(keypair, network);
console.log("reputation:", JSON.stringify(rep, null, 2));
