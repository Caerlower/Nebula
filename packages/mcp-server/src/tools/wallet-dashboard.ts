import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

import {
  buildDashboardSnapshot,
  formatDashboardSummary,
} from "../dashboard/snapshot.js";
import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult } from "./helpers.js";

export const DASHBOARD_UI_URI = "ui://nebula/dashboard.html";

function loadDashboardHtml(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(moduleDir, "..", "apps", "dashboard.html"),
    join(moduleDir, "..", "..", "dist", "apps", "dashboard.html"),
  ];

  for (const path of candidates) {
    try {
      return readFileSync(path, "utf8");
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    "Dashboard HTML not found. Reinstall nebula-mcp or run `pnpm --filter nebula-mcp build` from the monorepo.",
  );
}

export function registerWalletDashboardTool(server: McpServer): void {
  registerAppResource(
    server,
    "Nebula Wallet Dashboard",
    DASHBOARD_UI_URI,
    {
      description:
        "Interactive wallet dashboard for Claude — balances, limits, treasury, identity.",
    },
    async () => ({
      contents: [
        {
          uri: DASHBOARD_UI_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: loadDashboardHtml(),
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "wallet_dashboard",
    {
      title: "Wallet Dashboard",
      description:
        "Show an interactive Nebula wallet dashboard in chat: balances, spending limits, treasury, MPP session, and 8004 identity. Use this when the user asks to see their wallet status or dashboard.",
      _meta: {
        ui: { resourceUri: DASHBOARD_UI_URI },
      },
    },
    async () => {
      const wallet = loadWalletFromEnv();
      if (!wallet.ok) {
        return errorToolResult(wallet.error);
      }

      try {
        const snapshot = await buildDashboardSnapshot(
          wallet.keypair,
          wallet.network,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(snapshot),
            },
            {
              type: "text" as const,
              text: formatDashboardSummary(snapshot),
            },
          ],
        };
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "wallet_dashboard failed unexpectedly.",
        );
      }
    },
  );
}
