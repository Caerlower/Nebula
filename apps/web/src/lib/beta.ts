/**
 * Private-beta access gate, shared by the API route and the middleware.
 *
 * Valid invite codes come from the NEBULA_BETA_CODES env var (comma-separated,
 * e.g. in apps/web/.env.local) with a built-in default for local testing.
 * A valid code grants an httpOnly cookie whose value is the code itself, so
 * the middleware can re-validate on every request and revoking a code also
 * revokes existing sessions.
 */

export const BETA_COOKIE = "nebula_beta";
export const BETA_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30;

const DEFAULT_CODES = "NEBULA-CREW";

export function validBetaCodes(): Set<string> {
  return new Set(
    (process.env.NEBULA_BETA_CODES ?? DEFAULT_CODES)
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function isValidBetaCode(code: string | undefined | null): boolean {
  if (!code) return false;
  return validBetaCodes().has(code.trim().toUpperCase());
}
