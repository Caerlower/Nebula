import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPingTool(server: McpServer): void {
  server.registerTool(
    "ping",
    {
      description: "Health check — confirms Nebula MCP server is running.",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: `Nebula is alive\n${new Date().toISOString()}`,
        },
      ],
    }),
  );
}
