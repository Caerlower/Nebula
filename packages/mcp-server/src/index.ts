import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerCheckBalanceTool } from "./tools/check-balance.js";
import { registerGetAddressTool } from "./tools/get-address.js";
import { registerPingTool } from "./tools/ping.js";

const server = new McpServer({
  name: "nebula",
  version: "0.2.0",
});

registerPingTool(server);
registerGetAddressTool(server);
registerCheckBalanceTool(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("Nebula MCP server failed to start:", error);
  process.exit(1);
});
