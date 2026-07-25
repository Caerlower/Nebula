/**
 * Canonical Hub public URL (no trailing slash).
 * Prefer NEXT_PUBLIC_APP_URL in every environment.
 */
export const PRODUCTION_APP_URL = "https://www.nebulaonchain.xyz";

export function appBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
