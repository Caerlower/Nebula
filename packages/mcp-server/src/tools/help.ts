import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { formatHelp } from "../help/format.js";
import {
  HELP_CATEGORY_IDS,
  type HelpCategory,
} from "../help/catalog.js";
import { textToolResult } from "./helpers.js";

export function registerHelpTool(server: McpServer): void {
  server.registerTool(
    "help",
    {
      description:
        "Show all Nebula MCP features: tool catalog by category, env vars, quick-start prompts, and current config status.",
      inputSchema: {
        category: z
          .enum(HELP_CATEGORY_IDS as [HelpCategory, ...HelpCategory[]])
          .optional()
          .describe(
            "Optional category to filter: wallet, transfers, limits, policy, x402, mpp, treasury, identity",
          ),
      },
    },
    async ({ category }) => {
      return textToolResult(formatHelp(category ? { category } : undefined));
    },
  );
}
