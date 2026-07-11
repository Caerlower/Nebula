import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createClients,
  wrapBasicSigner,
  TESTNET_CONFIG,
  formatSorobanError,
} from "@trionlabs/stellar8004";
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

console.log("Nebula wallet:", publicKey);
console.log("Identity contract:", TESTNET_CONFIG.contracts.identity);
console.log("");

for (const agentId of [9, 10, 11]) {
  try {
    const existsTx = await identity.agent_exists({ agent_id: agentId });
    await existsTx.simulate();
    const ownerTx = await identity.find_owner({ agent_id: agentId });
    await ownerTx.simulate();
    const ownerOfTx = await identity.owner_of({ token_id: agentId });
    await ownerOfTx.simulate();
    const uriTx = await identity.agent_uri({ agent_id: agentId });
    await uriTx.simulate();

    console.log(`Agent ${agentId}:`);
    console.log("  exists:", existsTx.result);
    console.log("  find_owner:", ownerTx.result);
    console.log("  owner_of:", ownerOfTx.result);
    console.log("  agent_uri:", uriTx.result);
    console.log("");
  } catch (e) {
    console.log(`Agent ${agentId}: error`, formatSorobanError(e));
    console.log("");
  }
}

try {
  const balanceTx = await identity.balance({ account: publicKey });
  await balanceTx.simulate();
  console.log("Nebula wallet NFT balance:", balanceTx.result);

  const totalTx = await identity.total_agents();
  await totalTx.simulate();
  const total = Number(totalTx.result ?? 0);
  console.log("total_agents:", total);

  const owned = [];
  for (let id = 1; id <= total; id++) {
    const ownerTx = await identity.find_owner({ agent_id: id });
    await ownerTx.simulate();
    if (ownerTx.result === publicKey) owned.push(id);
  }
  console.log("Agent IDs owned by Nebula wallet:", owned);
} catch (e) {
  console.error(formatSorobanError(e));
}
