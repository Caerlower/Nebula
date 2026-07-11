import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { formatMppFetchResult, mppFetch } from "../mpp/fetch.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerMppFetchTool(server: McpServer): void {
  server.registerTool(
    "mpp_fetch",
    {
      description:
        "Fetch a URL against an MPP channel server while a session is open. Signs off-chain cumulative commitments (no per-request on-chain tx). Rejects payments that would exceed the session budget.",
      inputSchema: {
        url: z.string().url().describe("MPP channel-gated URL to fetch (GET)"),
      },
    },
    async ({ url }) => {
      try {
        const result = await mppFetch(url);
        if (!result.ok) {
          return errorToolResult(result.error);
        }

        return textToolResult(formatMppFetchResult(result));
      } catch (error) {
        return errorToolResult(
          error instanceof Error ? error.message : "mpp_fetch failed unexpectedly.",
        );
      }
    },
  );
}
