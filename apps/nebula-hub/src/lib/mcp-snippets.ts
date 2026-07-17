import type { Framework } from "@/types/domain";

/**
 * Canonical, copy-paste MCP client configs, one per supported client.
 * Shared by the Connect page (placeholder token) and the agent-created success
 * screen (real token substituted). Keeping a single source means both screens
 * always agree on server name ("nebula"), Hub host, and transport.
 */

export const HUB = "https://www.nebulaonchain.xyz";
export const MCP_URL = `${HUB}/mcp`;

/** Placeholder that {@link getSnippet} swaps for a real token when provided. */
export const TOKEN_PLACEHOLDER = "nbl_live_…";

export interface Snippet {
  install: { code: string; language: "bash"; title: string };
  config: {
    code: string;
    language: "bash" | "json" | "typescript" | "python";
    title: string;
  };
  note: string;
}

const SNIPPETS: Record<Framework, Snippet> = {
  "claude-desktop": {
    install: {
      title: "prerequisites",
      language: "bash",
      code: `# 1. Mint a token above (${TOKEN_PLACEHOLDER})
# 2. Node 20+ on the machine that runs Claude Desktop
node --version`,
    },
    config: {
      title: "claude_desktop_config.json",
      language: "json",
      code: `{
  "mcpServers": {
    "nebula": {
      "command": "npx",
      "args": ["-y", "nebulamcp-stdio"],
      "env": {
        "NEBULA_TOKEN": "${TOKEN_PLACEHOLDER}",
        "NEBULA_HUB": "${HUB}"
      }
    }
  }
}`,
    },
    note: `macOS: ~/Library/Application Support/Claude/claude_desktop_config.json · Windows: %APPDATA%\\Claude\\claude_desktop_config.json. Restart Claude Desktop after saving. Same JSON works in Cursor (.cursor/mcp.json). Never put a Stellar secret key here — only NEBULA_TOKEN.`,
  },
  "claude-code": {
    install: {
      title: "prerequisites",
      language: "bash",
      code: `# Mint a token above first (${TOKEN_PLACEHOLDER})
claude --version`,
    },
    config: {
      title: "add Nebula (recommended)",
      language: "bash",
      code: `# Remote Streamable HTTP — no npm install. Talks straight to the Hub.
claude mcp add --transport http nebula ${MCP_URL} \\
  --header "Authorization: Bearer ${TOKEN_PLACEHOLDER}"

# Confirm it registered
claude mcp list

# Optional: project-only vs user-wide
#   claude mcp add --transport http nebula ${MCP_URL} --scope project \\
#     --header "Authorization: Bearer ${TOKEN_PLACEHOLDER}"
#   claude mcp add --transport http nebula ${MCP_URL} --scope user \\
#     --header "Authorization: Bearer ${TOKEN_PLACEHOLDER}"`,
    },
    note: `Prefer HTTP for Claude Code — it hits ${MCP_URL} with your token. Stdio fallback (local npx bridge): claude mcp add nebula -e NEBULA_TOKEN=${TOKEN_PLACEHOLDER} -e NEBULA_HUB=${HUB} -- npx -y nebulamcp-stdio`,
  },
  "custom-mcp": {
    install: {
      title: "install",
      language: "bash",
      code: `npm install @modelcontextprotocol/sdk
# Mint a token above first (${TOKEN_PLACEHOLDER})`,
    },
    config: {
      title: "remote Streamable HTTP",
      language: "typescript",
      code: `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const token = process.env.NEBULA_TOKEN!; // ${TOKEN_PLACEHOLDER}

const transport = new StreamableHTTPClientTransport(
  new URL("${MCP_URL}"),
  {
    requestInit: {
      headers: { Authorization: \`Bearer \${token}\` },
    },
  },
);

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log(tools.tools.map((t) => t.name));

const balance = await client.callTool({
  name: "check_balance",
  arguments: {},
});
console.log(balance);`,
    },
    note: `Endpoint: POST ${MCP_URL} with Authorization: Bearer ${TOKEN_PLACEHOLDER}. Use the www host (apex redirects can drop the Bearer header). OAuth DCR for hosted connectors: /api/oauth/register → /authorize → /oauth/token.`,
  },
  "openai-sdk": {
    install: {
      title: "install",
      language: "bash",
      code: `pip install openai-agents
# Mint a token above first (${TOKEN_PLACEHOLDER})
# Requires Node 20+ on PATH for npx nebulamcp-stdio`,
    },
    config: {
      title: "agent.py",
      language: "python",
      code: `import os
from agents import Agent, Runner
from agents.mcp import MCPServerStdio

nebula = MCPServerStdio(
    name="nebula",
    params={
        "command": "npx",
        "args": ["-y", "nebulamcp-stdio"],
        "env": {
            **os.environ,
            "NEBULA_TOKEN": os.environ["NEBULA_TOKEN"],
            "NEBULA_HUB": os.environ.get("NEBULA_HUB", "${HUB}"),
        },
    },
)

async def main() -> None:
    async with nebula:
        agent = Agent(
            name="Treasurer",
            instructions="Manage the wallet. Respect the spending policy.",
            mcp_servers=[nebula],
        )
        result = await Runner.run(agent, "What's my balance?")
        print(result.final_output)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())`,
    },
    note: `Stdio bridge: nebulamcp-stdio presents NEBULA_TOKEN to the Hub. Prefer async with MCPServerStdio so the subprocess cleans up. For remote HTTP instead, POST ${MCP_URL} with Bearer ${TOKEN_PLACEHOLDER} (same as Custom MCP).`,
  },
};

/**
 * Return the snippet for a client. When `token` is supplied, the placeholder is
 * replaced with the real key so the config is paste-ready.
 */
export function getSnippet(framework: Framework, token?: string): Snippet {
  const base = SNIPPETS[framework];
  if (!token) return base;
  const sub = (code: string) => code.split(TOKEN_PLACEHOLDER).join(token);
  return {
    install: { ...base.install, code: sub(base.install.code) },
    config: { ...base.config, code: sub(base.config.code) },
    note: sub(base.note),
  };
}
