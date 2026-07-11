import {
  createClients,
  wrapBasicSigner,
  type ClientSet,
} from "@trionlabs/stellar8004";
import type { Keypair } from "@stellar/stellar-sdk";

import type { NetworkConfig } from "../config.js";
import { get8004Config } from "./config.js";

export function create8004Clients(
  keypair: Keypair,
  network: NetworkConfig,
): ClientSet {
  const config = get8004Config(network);
  const signer = wrapBasicSigner(keypair, config.networkPassphrase);
  return createClients(config, signer);
}
