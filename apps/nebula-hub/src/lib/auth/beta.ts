/**
 * Private-beta access gate, shared by the API route and the middleware.
 *
 * Valid invite codes come from NEBULA_BETA_CODES (comma-separated).
 * Locally, a built-in default applies when the env is unset so `pnpm dev`
 * works without config. In production / on Vercel the env is required —
 * an empty set means nobody gets in until codes are configured.
 */

export const BETA_COOKIE = "nebula_beta";
export const BETA_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30;

const LOCAL_DEFAULT_CODES = "NEBULA-CREW";

function isProdRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1"
  );
}

export function validBetaCodes(): Set<string> {
  const raw = process.env.NEBULA_BETA_CODES?.trim();
  const source =
    raw && raw.length > 0
      ? raw
      : isProdRuntime()
        ? ""
        : LOCAL_DEFAULT_CODES;

  if (!raw && isProdRuntime()) {
    console.error(
      "[beta] NEBULA_BETA_CODES is unset in production — beta gate rejects all codes",
    );
  }

  return new Set(
    source
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function isValidBetaCode(code: string | undefined | null): boolean {
  if (!code) return false;
  return validBetaCodes().has(code.trim().toUpperCase());
}

export async function fetchBetaStatus(): Promise<boolean> {
  try {
    const res = await fetch("/api/beta", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { granted?: boolean };
    return data.granted === true;
  } catch {
    return false;
  }
}

/** Returns true when the code was accepted (cookie now set). */
export async function redeemBetaCode(code: string): Promise<boolean> {
  const res = await fetch("/api/beta", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (res.status === 401) return false;
  if (!res.ok) throw new Error("Beta check failed");
  return true;
}
