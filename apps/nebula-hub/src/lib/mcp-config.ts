import { appBaseUrl } from "./oauth";

/**
 * Build ready-to-paste MCP client configs for a freshly minted Nebula token.
 * The plaintext token is only available at mint time, so this is the one moment
 * we can hand the user a one-click config. Returns both the remote Streamable
 * HTTP form (Cursor / Claude Code / custom) and the stdio bridge form
 * (Claude Desktop / OpenAI Agents) so the UI can show whichever the agent uses.
 */
export function buildMcpConfig(params: {
  token: string;
  /** Server label in the client config; defaults to "nebula". */
  serverName?: string;
}): {
  hub: string;
  mcp_url: string;
  server_name: string;
  streamable_http: Record<string, unknown>;
  claude_desktop: Record<string, unknown>;
  claude_code_command: string;
} {
  const hub = appBaseUrl();
  const mcpUrl = `${hub}/mcp`;
  const name = (params.serverName ?? "nebula")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "nebula";

  return {
    hub,
    mcp_url: mcpUrl,
    server_name: name,
    // Cursor / Claude Code / any Streamable HTTP client — no local package.
    streamable_http: {
      mcpServers: {
        [name]: {
          url: mcpUrl,
          headers: { Authorization: `Bearer ${params.token}` },
        },
      },
    },
    // Claude Desktop / OpenAI Agents — stdio bridge forwards to the Hub.
    claude_desktop: {
      mcpServers: {
        [name]: {
          command: "npx",
          args: ["-y", "nebulamcp-stdio"],
          env: { NEBULA_TOKEN: params.token, NEBULA_HUB: hub },
        },
      },
    },
    claude_code_command: `claude mcp add --transport http ${name} ${mcpUrl} --header "Authorization: Bearer ${params.token}"`,
  };
}
