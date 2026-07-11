import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Load packages/mcp-server/.env into process.env (does not override existing vars). */
export function loadDotEnv(): void {
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env"),
    join(process.cwd(), ".env"),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) {
      continue;
    }

    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const eq = trimmed.indexOf("=");
      if (eq === -1) {
        continue;
      }

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    return;
  }
}

loadDotEnv();
