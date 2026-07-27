import { hubOriginFor, type HubNetwork } from "@/lib/network";

/**
 * Ready-to-paste MCP client configs for a freshly minted Nebula token.
 * Plaintext is only available at mint time.
 */
export function buildMcpConfig(params: {
  token: string;
  /** Server label in the client config; defaults to "nebula". */
  serverName?: string;
  /** Ledger for NEBULA_HUB — Agent.network / request Host. */
  network: HubNetwork;
}): {
  hub: string;
  mcp_url: string;
  server_name: string;
  streamable_http: Record<string, unknown>;
  claude_desktop: Record<string, unknown>;
  claude_code_command: string;
} {
  const hub = hubOriginFor(params.network).replace(/\/$/, "");
  const mcpUrl = `${hub}/mcp`;
  const name =
    (params.serverName ?? "nebula")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "nebula";

  return {
    hub,
    mcp_url: mcpUrl,
    server_name: name,
    streamable_http: {
      mcpServers: {
        [name]: {
          url: mcpUrl,
          headers: { Authorization: `Bearer ${params.token}` },
        },
      },
    },
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
