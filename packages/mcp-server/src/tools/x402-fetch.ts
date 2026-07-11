import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { formatX402FetchResult, x402Fetch } from "../x402/fetch.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerX402FetchTool(server: McpServer): void {
  server.registerTool(
    "x402_fetch",
    {
      description:
        "Fetch a URL. If the server returns HTTP 402, pay with Stellar USDC via x402 (subject to spending limits) and retry automatically.",
      inputSchema: {
        url: z.string().url().describe("URL to fetch (GET)"),
      },
    },
    async ({ url }) => {
      try {
        const result = await x402Fetch(url);
        if (!result.ok) {
          return errorToolResult(result.error);
        }

        return textToolResult(formatX402FetchResult(result));
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "x402_fetch failed unexpectedly.",
        );
      }
    },
  );
}
