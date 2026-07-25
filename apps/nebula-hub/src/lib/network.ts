/**
 * Hub Stellar network resolution.
 * Prefer the signed-in user's preferredNetwork; fall back to STELLAR_NETWORK.
 */

export type HubNetwork = "testnet" | "mainnet";

export function envHubNetwork(): HubNetwork {
  return process.env.STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

export function parseHubNetwork(value: unknown): HubNetwork | null {
  if (value === "mainnet" || value === "testnet") return value;
  return null;
}

/** When false, accounts cannot prefer mainnet (ops kill-switch). Default: allowed. */
export function mainnetPreferenceAllowed(): boolean {
  const flag = process.env.MAINNET_ENABLED?.trim();
  if (flag === "0" || flag === "false") return false;
  return true;
}

/** Resolve network for an authenticated Hub principal. */
export function networkFromPrincipal(principal: {
  network?: HubNetwork | null;
}): HubNetwork {
  const preferred = parseHubNetwork(principal.network);
  if (preferred === "mainnet" && !mainnetPreferenceAllowed()) {
    return envHubNetwork() === "mainnet" ? "mainnet" : "testnet";
  }
  return preferred ?? envHubNetwork();
}

/**
 * Policy contract id for a network.
 *
 * - mainnet: only `POLICY_CONTRACT_ID_MAINNET` (no legacy fallback — the shared
 *   `POLICY_CONTRACT_ID` is the historical testnet deploy).
 * - testnet: `POLICY_CONTRACT_ID_TESTNET`, else legacy `POLICY_CONTRACT_ID`.
 */
export function policyContractIdFor(network: HubNetwork): string | null {
  if (network === "mainnet") {
    return process.env.POLICY_CONTRACT_ID_MAINNET?.trim() || null;
  }
  return (
    process.env.POLICY_CONTRACT_ID_TESTNET?.trim() ||
    process.env.POLICY_CONTRACT_ID?.trim() ||
    null
  );
}

export function policyContractConfiguredFor(network: HubNetwork): boolean {
  return Boolean(policyContractIdFor(network));
}
