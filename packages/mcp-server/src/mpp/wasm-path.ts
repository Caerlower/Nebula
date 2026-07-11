import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** SHA-256 of bundled `contracts/channel.wasm` (one-way-channel, stellar-experimental). */
export const CHANNEL_WASM_HASH =
  "ab3bb0da02d07610872b4a2f5dbbe9cf0a40e0544f63981097604f9d08d2a164";

export function resolveChannelWasmPath():
  | { ok: true; path: string; bundled: boolean }
  | { ok: false; error: string } {
  const override = process.env.MPP_CHANNEL_WASM_PATH?.trim();
  if (override) {
    if (!existsSync(override)) {
      return {
        ok: false,
        error: `MPP_CHANNEL_WASM_PATH file not found or unreadable: ${override}`,
      };
    }
    return { ok: true, path: override, bundled: false };
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(moduleDir, "..", "contracts", "channel.wasm"),
    join(moduleDir, "..", "..", "contracts", "channel.wasm"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { ok: true, path: candidate, bundled: true };
    }
  }

  return {
    ok: false,
    error:
      "Bundled channel.wasm is missing. Reinstall nebula-mcp or rebuild from source (pnpm --filter nebula-mcp build). Override with MPP_CHANNEL_WASM_PATH.",
  };
}
