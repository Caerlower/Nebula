/**
 * Canonical Hub public URL (no trailing slash).
 *
 * Prefer the current request Host (via ALS) so OAuth / MCP / MPP URLs match
 * the ledger subdomain. Env is fallback for non-request contexts.
 */
import { AsyncLocalStorage } from "node:async_hooks";

import {
  hubOriginFor,
  isApexOrWwwHost,
  networkFromHostname,
} from "@/lib/network";

export const PRODUCTION_APP_URL = "https://testnet.nebulaonchain.xyz";

const appRequestAls = new AsyncLocalStorage<{ origin: string }>();

function stripPort(host: string): string {
  if (host.startsWith("[")) return host;
  const idx = host.lastIndexOf(":");
  if (idx > 0 && /^\d+$/.test(host.slice(idx + 1))) return host.slice(0, idx);
  return host;
}

function canonicalizeAppUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return trimmed;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = stripPort(url.hostname.toLowerCase());
    if (isApexOrWwwHost(host)) return hubOriginFor("testnet");
    const network = networkFromHostname(host);
    if (network) return hubOriginFor(network);
    return `${url.protocol}//${url.host}`.replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

export function hostFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwarded || headers.get("host")?.trim() || "").toLowerCase();
  return host || null;
}

function originFromRequestHeaders(headers: Headers): string | null {
  const host = hostFromHeaders(headers);
  if (!host) return null;
  const hostname = stripPort(host);
  const network = networkFromHostname(hostname);
  if (network) return hubOriginFor(network);
  if (isApexOrWwwHost(hostname)) return hubOriginFor("testnet");
  const forwarded = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwarded === "http" || forwarded === "https"
      ? forwarded
      : hostname.startsWith("localhost") || hostname.startsWith("127.0.0.1")
        ? "http"
        : "https";
  return `${proto}://${host}`.replace(/\/$/, "");
}

/** Bind request Host so sync `appBaseUrl()` sees the ledger subdomain. */
export async function runWithAppRequestAsync<T>(
  req: { headers: Headers },
  fn: () => Promise<T>,
): Promise<T> {
  const origin = originFromRequestHeaders(req.headers) ?? appBaseUrlFromEnv();
  return appRequestAls.run({ origin }, fn);
}

function appBaseUrlFromEnv(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    "";
  if (fromEnv) return canonicalizeAppUrl(fromEnv);
  if (process.env.VERCEL_URL?.trim()) {
    return canonicalizeAppUrl(`https://${process.env.VERCEL_URL.trim()}`);
  }
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_URL;
  }
  return "http://localhost:3000";
}

export function appBaseUrl(hostHint?: string | null): string {
  const fromAls = appRequestAls.getStore()?.origin;
  if (fromAls) return fromAls;

  if (hostHint?.trim()) {
    const host = stripPort(hostHint.trim().toLowerCase());
    const network = networkFromHostname(host);
    if (network) return hubOriginFor(network);
    if (isApexOrWwwHost(host)) return hubOriginFor("testnet");
    const proto =
      host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https";
    return `${proto}://${hostHint.trim()}`.replace(/\/$/, "");
  }

  return appBaseUrlFromEnv();
}
