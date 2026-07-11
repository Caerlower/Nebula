import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { POLICY_WASM_HASH } from "./config.js";

export { POLICY_WASM_HASH };

export function resolvePolicyWasmPath():
  | { ok: true; path: string; bundled: boolean }
  | { ok: false; error: string } {
  const override = process.env.POLICY_WASM_PATH?.trim();
  if (override) {
    if (!existsSync(override)) {
      return {
        ok: false,
        error: `POLICY_WASM_PATH file not found or unreadable: ${override}`,
      };
    }
    return { ok: true, path: override, bundled: false };
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(moduleDir, "..", "..", "contracts", "policy.wasm"),
    join(moduleDir, "..", "contracts", "policy.wasm"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { ok: true, path: candidate, bundled: true };
    }
  }

  return {
    ok: false,
    error:
      "Bundled policy.wasm is missing. Reinstall nebula-mcp or rebuild from source (pnpm --filter nebula-mcp build). Override with POLICY_WASM_PATH.",
  };
}
