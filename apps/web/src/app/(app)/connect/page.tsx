"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, PlugZap } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ApiKeysCard } from "@/components/shared/api-keys-card";
import { CodeBlock } from "@/components/shared/code-block";
import { FRAMEWORK_META } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as api from "@/lib/api";
import type { Framework } from "@/mocks/types";

interface Snippet {
  install: { code: string; language: "bash"; title: string };
  config: { code: string; language: "bash" | "json" | "typescript" | "python"; title: string };
  note: string;
}

const SNIPPETS: Record<Framework, Snippet> = {
  "claude-desktop": {
    install: {
      title: "install",
      language: "bash",
      code: `# Nothing to install — npx fetches nebula-mcp on demand.
# Just make sure Node 20+ is available:
node --version`,
    },
    config: {
      title: "claude_desktop_config.json",
      language: "json",
      code: `{
  "mcpServers": {
    "nebula": {
      "command": "npx",
      "args": ["-y", "nebula-mcp"],
      "env": {
        "NEBULA_API_KEY": "nbl_live_…",
        "NETWORK": "testnet"
      }
    }
  }
}`,
    },
    note: "Settings → Developer → Edit Config, then restart Claude Desktop. The hammer icon should list Nebula's 22 tools.",
  },
  "claude-code": {
    install: {
      title: "install",
      language: "bash",
      code: `# Claude Code ships an MCP manager — no separate install.
claude --version`,
    },
    config: {
      title: "add the server",
      language: "bash",
      code: `claude mcp add nebula \\
  -e NEBULA_API_KEY=nbl_live_… \\
  -e NETWORK=testnet \\
  -- npx -y nebula-mcp

# verify
claude mcp list`,
    },
    note: "Run inside your project for a project-scoped server, or add --scope user to share it across projects.",
  },
  "custom-mcp": {
    install: {
      title: "install",
      language: "bash",
      code: `npm install @modelcontextprotocol/sdk`,
    },
    config: {
      title: "client.ts",
      language: "typescript",
      code: `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "nebula-mcp"],
  env: {
    NEBULA_API_KEY: process.env.NEBULA_API_KEY!,
    NETWORK: "testnet",
  },
});

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(transport);

const balance = await client.callTool({
  name: "check_balance",
  arguments: {},
});
console.log(balance);`,
    },
    note: "Any MCP-compatible client works — Nebula speaks plain stdio MCP with 22 tools for payments, treasury, policy, and reputation.",
  },
  "openai-sdk": {
    install: {
      title: "install",
      language: "bash",
      code: `pip install openai-agents`,
    },
    config: {
      title: "agent.py",
      language: "python",
      code: `import os
from agents import Agent, Runner
from agents.mcp import MCPServerStdio

nebula = MCPServerStdio(
    params={
        "command": "npx",
        "args": ["-y", "nebula-mcp"],
        "env": {
            "NEBULA_API_KEY": os.environ["NEBULA_API_KEY"],
            "NETWORK": "testnet",
        },
    }
)

agent = Agent(
    name="Treasurer",
    instructions="Manage the wallet. Respect the spending policy.",
    mcp_servers=[nebula],
)

result = Runner.run_sync(agent, "What's my balance and current APY?")
print(result.final_output)`,
    },
    note: "The OpenAI Agents SDK mounts MCP servers directly — Nebula's tools appear as native function tools.",
  },
};

function TestConnection({ framework }: { framework: Framework }) {
  const [state, setState] = useState<"idle" | "testing" | "ok">("idle");
  const [latency, setLatency] = useState<number | null>(null);

  const test = async () => {
    setState("testing");
    try {
      const { latencyMs } = await api.testConnection(framework);
      setLatency(latencyMs);
      setState("ok");
    } catch {
      setState("idle");
      toast.error("Connection test failed", {
        action: { label: "Retry", onClick: () => void test() },
      });
    }
  };

  if (state === "ok") {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-success" role="status">
        <CheckCircle2 className="size-4" aria-hidden />
        Connected — MCP handshake complete{latency != null ? ` (${latency}ms)` : ""}
      </p>
    );
  }

  return (
    <Button variant="outline" onClick={() => void test()} disabled={state === "testing"}>
      {state === "testing" ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Testing…
        </>
      ) : (
        <>
          <PlugZap className="size-4" /> Test connection
        </>
      )}
    </Button>
  );
}

export default function ConnectPage() {
  return (
    <div>
      <PageHeader
        eyebrow="setup"
        title="Connect"
        subtitle="Plug Nebula into your agent — one MCP server, 22 wallet tools."
      />

      <Tabs defaultValue="claude-desktop">
        <TabsList aria-label="Framework">
          {(Object.keys(SNIPPETS) as Framework[]).map((framework) => (
            <TabsTrigger key={framework} value={framework}>
              {FRAMEWORK_META[framework].label}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(SNIPPETS) as Framework[]).map((framework) => {
          const snippet = SNIPPETS[framework];
          return (
            <TabsContent key={framework} value={framework} className="mt-5">
              <Card className="space-y-5 p-5">
                <div>
                  <p className="mb-2 text-[13px] font-medium text-muted-foreground">
                    1 · Install
                  </p>
                  <CodeBlock
                    code={snippet.install.code}
                    language={snippet.install.language}
                    title={snippet.install.title}
                  />
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-medium text-muted-foreground">
                    2 · Configure
                  </p>
                  <CodeBlock
                    code={snippet.config.code}
                    language={snippet.config.language}
                    title={snippet.config.title}
                  />
                  <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                    {snippet.note}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-medium text-muted-foreground">3 · Verify</p>
                  <TestConnection framework={framework} />
                </div>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="mt-6">
        <ApiKeysCard />
      </div>
    </div>
  );
}
