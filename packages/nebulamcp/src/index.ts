#!/usr/bin/env node
/**
 * Thin stdio MCP wrapper. No private keys. Forwards every tool call to the Hub.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { formatToolResultForMcp, listToolsForMcp } from "nebulamcp-core";

const HUB = (process.env.NEBULA_HUB ?? "https://www.nebulaonchain.xyz").replace(
  /\/$/,
  "",
);
const TOKEN = process.env.NEBULA_TOKEN?.trim();

if (!TOKEN) {
  console.error(
    "NEBULA_TOKEN not set. Generate one at https://www.nebulaonchain.xyz/connect",
  );
  process.exit(1);
}

if (TOKEN.startsWith("S") && TOKEN.length > 50) {
  console.error(
    "Refusing to start: NEBULA_TOKEN looks like a Stellar secret key. Use an nbl_live_… token from the Hub.",
  );
  process.exit(1);
}

const server = new Server(
  { name: "nebula", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: listToolsForMcp(),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = req.params.arguments ?? {};

  const res = await fetch(`${HUB}/api/tools/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  let data: Parameters<typeof formatToolResultForMcp>[0] & {
    reason?: string;
    message?: string;
  };

  try {
    data = (await res.json()) as typeof data;
  } catch {
    return {
      content: [
        {
          type: "text" as const,
          text: `Hub error: HTTP ${res.status} (non-JSON body)`,
        },
      ],
      isError: true,
    };
  }

  if (
    !res.ok &&
    data.status !== "confirmation_required" &&
    data.status !== "rejected" &&
    data.status !== "ok"
  ) {
    return {
      content: [
        {
          type: "text" as const,
          text: data.reason ?? data.message ?? `Hub HTTP ${res.status}`,
        },
      ],
      isError: true,
    };
  }

  return formatToolResultForMcp(data);
});

const transport = new StdioServerTransport();
await server.connect(transport);
