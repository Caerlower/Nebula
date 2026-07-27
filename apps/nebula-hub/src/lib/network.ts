/**
 * Hub Stellar network resolution.
 *
 * Production: Host is the source of truth
 * (`testnet.nebulaonchain.xyz` / `mainnet.nebulaonchain.xyz`).
 * Localhost / preview: fall back to STELLAR_NETWORK / NEXT_PUBLIC_HUB_NETWORK.
 */

export type HubNetwork = "testnet" | "mainnet";

const APEX_HOSTS = new Set(["nebulaonchain.xyz", "www.nebulaonchain.xyz"]);

export const DEFAULT_HUB_ORIGIN_TESTNET = "https://testnet.nebulaonchain.xyz";
export const DEFAULT_HUB_ORIGIN_MAINNET = "https://mainnet.nebulaonchain.xyz";

export function envHubNetwork(): HubNetwork {
  const pub = process.env.NEXT_PUBLIC_HUB_NETWORK?.trim();
  if (pub === "mainnet" || pub === "testnet") return pub;
  return process.env.STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

export function parseHubNetwork(value: unknown): HubNetwork | null {
  if (value === "mainnet" || value === "testnet") return value;
  return null;
}

/** When false, mainnet host is redirected and chip disables mainnet. Default: allowed. */
export function mainnetPreferenceAllowed(): boolean {
  const flag = process.env.MAINNET_ENABLED?.trim();
  if (flag === "0" || flag === "false") return false;
  return true;
}

/**
 * Map request hostname → ledger. Returns null for localhost / Vercel previews /
 * apex+www (those fall back to env or redirect to testnet).
 */
export function networkFromHostname(hostname: string | null | undefined): HubNetwork | null {
  if (!hostname) return null;
  const host = hostname.trim().toLowerCase().split(":")[0] ?? "";
  if (!host) return null;
  if (host === "testnet.nebulaonchain.xyz" || host.startsWith("testnet.")) {
    return "testnet";
  }
  if (host === "mainnet.nebulaonchain.xyz" || host.startsWith("mainnet.")) {
    return "mainnet";
  }
  return null;
}

export function isApexOrWwwHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const host = hostname.trim().toLowerCase().split(":")[0] ?? "";
  return APEX_HOSTS.has(host);
}

export function isLocalHostname(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const host = hostname.trim().toLowerCase().split(":")[0] ?? "";
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  );
}

/** Public origin for a ledger Hub (no trailing slash). */
export function hubOriginFor(network: HubNetwork): string {
  if (network === "mainnet") {
    return (
      process.env.NEXT_PUBLIC_HUB_ORIGIN_MAINNET?.trim().replace(/\/$/, "") ||
      process.env.HUB_ORIGIN_MAINNET?.trim().replace(/\/$/, "") ||
      DEFAULT_HUB_ORIGIN_MAINNET
    );
  }
  return (
    process.env.NEXT_PUBLIC_HUB_ORIGIN_TESTNET?.trim().replace(/\/$/, "") ||
    process.env.HUB_ORIGIN_TESTNET?.trim().replace(/\/$/, "") ||
    DEFAULT_HUB_ORIGIN_TESTNET
  );
}

/**
 * Resolve dashboard network: Host wins, then explicit preferred, then env.
 * Mainnet kill-switch forces testnet (unless deploy default is mainnet-only).
 */
export function resolveHubNetwork(opts: {
  hostname?: string | null;
  preferred?: HubNetwork | null;
}): HubNetwork {
  const fromHost = networkFromHostname(opts.hostname ?? null);
  if (fromHost === "mainnet" && !mainnetPreferenceAllowed()) {
    return "testnet";
  }
  if (fromHost) return fromHost;

  const preferred = parseHubNetwork(opts.preferred);
  if (preferred === "mainnet" && !mainnetPreferenceAllowed()) {
    return envHubNetwork() === "mainnet" ? "mainnet" : "testnet";
  }
  if (preferred) return preferred;
  return envHubNetwork();
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
