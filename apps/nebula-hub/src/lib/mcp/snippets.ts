import {
  hubOriginFor,
  isLocalHostname,
  networkFromHostname,
  type HubNetwork,
} from "@/lib/network";
import type { Framework } from "@/types/domain";

/**
 * Copy-paste MCP client configs for the Connect page.
 * Do not import `@/lib/app-url` here — it uses node:async_hooks (server-only).
 */

const TOKEN_PLACEHOLDER = "nbl_live_…";
const HUB_PLACEHOLDER = "__NEBULA_HUB__";
const MCP_PLACEHOLDER = "__NEBULA_MCP__";

/** Hub origin for Connect snippets — Host on the client, else ledger default. */
export function resolveSnippetHub(network?: HubNetwork | null): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const fromHost = networkFromHostname(host);
    if (fromHost) return hubOriginFor(fromHost);
    if (isLocalHostname(host)) {
      return window.location.origin.replace(/\/$/, "");
    }
  }
  if (network === "mainnet" || network === "testnet") {
    return hubOriginFor(network);
  }
  return hubOriginFor("testnet");
}

export interface Snippet {
  config: {
    code: string;
    language: "bash" | "json" | "typescript" | "python";
    title: string;
  };
  pasteTargets: { label: string; path: string }[];
}

const SNIPPETS: Record<Framework, Snippet> = {
  "claude-desktop": {
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
        "NEBULA_HUB": "${HUB_PLACEHOLDER}"
      }
    }
  }
}`,
    },
    pasteTargets: [
      {
        label: "macOS · Claude Desktop",
        path: "~/Library/Application Support/Claude/claude_desktop_config.json",
      },
      {
        label: "Windows · Claude Desktop",
        path: "%APPDATA%\\Claude\\claude_desktop_config.json",
      },
    ],
  },
  "claude-code": {
    config: {
      title: "add Nebula (recommended)",
      language: "bash",
      code: `# Remote Streamable HTTP — no npm install. Talks straight to the Hub.
claude mcp add --transport http nebula ${MCP_PLACEHOLDER} \\
  --header "Authorization: Bearer ${TOKEN_PLACEHOLDER}"

# Confirm it registered
claude mcp list`,
    },
    pasteTargets: [
      {
        label: "Terminal",
        path: "Run the LIVE CONFIG command in your terminal",
      },
      {
        label: "User scope",
        path: "~/.claude.json",
      },
      {
        label: "Project scope",
        path: ".mcp.json",
      },
    ],
  },
  "custom-mcp": {
    config: {
      title: "remote Streamable HTTP",
      language: "typescript",
      code: `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const token = process.env.NEBULA_TOKEN!; // ${TOKEN_PLACEHOLDER}

const transport = new StreamableHTTPClientTransport(
  new URL("${MCP_PLACEHOLDER}"),
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
    pasteTargets: [
      {
        label: "Claude.ai · Custom connector",
        path: `${MCP_PLACEHOLDER}  (OAuth — do not use apex/www)`,
      },
      {
        label: "Your agent code",
        path: "src/agent.ts (or your entrypoint)",
      },
      {
        label: "HTTP endpoint",
        path: `POST ${MCP_PLACEHOLDER} with Authorization: Bearer`,
      },
    ],
  },
  "openai-sdk": {
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
            "NEBULA_HUB": os.environ.get("NEBULA_HUB", "${HUB_PLACEHOLDER}"),
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
    pasteTargets: [
      {
        label: "Python agent",
        path: "agent.py",
      },
      {
        label: "Environment",
        path: "Export NEBULA_TOKEN (+ NEBULA_HUB for this ledger) in your shell env",
      },
    ],
  },
};

/** LIVE CONFIG for a client. URLs match the current ledger Host. */
export function getSnippet(
  framework: Framework,
  network?: HubNetwork | null,
): Snippet {
  const base = SNIPPETS[framework];
  const hub = resolveSnippetHub(network).replace(/\/$/, "");
  const mcp = `${hub}/mcp`;
  const fill = (code: string) =>
    code.split(HUB_PLACEHOLDER).join(hub).split(MCP_PLACEHOLDER).join(mcp);

  return {
    config: { ...base.config, code: fill(base.config.code) },
    pasteTargets: base.pasteTargets.map((t) => ({
      ...t,
      path: fill(t.path),
    })),
  };
}
