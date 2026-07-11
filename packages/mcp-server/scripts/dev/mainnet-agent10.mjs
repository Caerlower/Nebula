import {
  createClients,
  wrapBasicSigner,
  MAINNET_CONFIG,
  formatSorobanError,
} from "@trionlabs/stellar8004";
import { Keypair } from "@stellar/stellar-sdk";

// Use a funded mainnet account only as simulation source (read-only calls).
const MAINNET_SIM_SOURCE =
  "GDDTQFQZK734EXIJE5LWU4G4YC5A6P5AHJ4UWVMV6WBFWT6BAAQQHV2V";

const keypair = Keypair.random();
const signer = wrapBasicSigner(keypair, MAINNET_CONFIG.networkPassphrase);
const { identity } = createClients(MAINNET_CONFIG, {
  ...signer,
  publicKey: MAINNET_SIM_SOURCE,
});

console.log("mainnet identity:", MAINNET_CONFIG.contracts.identity);

for (const agentId of [9, 10, 11]) {
  try {
    const ownerTx = await identity.find_owner({ agent_id: agentId });
    await ownerTx.simulate();
    console.log(`mainnet agent ${agentId} owner:`, ownerTx.result);
  } catch (e) {
    console.log(`mainnet agent ${agentId}:`, formatSorobanError(e));
  }
}
