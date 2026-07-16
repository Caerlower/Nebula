"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePrivy } from "@privy-io/react-auth";
import { CheckCircle2, Loader2, PlugZap } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ApiKeysCard } from "@/components/shared/api-keys-card";
import { CodeBlock } from "@/components/shared/code-block";
import { FRAMEWORK_META } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as api from "@/lib/api";
import type { Framework } from "@/types/domain";

const HUB = "https://www.nebulaonchain.xyz";
const MCP_URL = `${HUB}/mcp`;

interface Snippet {
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
      code: `# 1. Mint a token above (nbl_live_…)
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
        "NEBULA_TOKEN": "nbl_live_…",
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
      code: `# Mint a token above first (nbl_live_…)
claude --version`,
    },
    config: {
      title: "add Nebula (recommended)",
      language: "bash",
      code: `# Remote Streamable HTTP — no npm install. Talks straight to the Hub.
claude mcp add --transport http nebula ${MCP_URL} \\
  --header "Authorization: Bearer nbl_live_…"

# Confirm it registered
claude mcp list

# Optional: project-only vs user-wide
#   claude mcp add --transport http nebula ${MCP_URL} --scope project \\
#     --header "Authorization: Bearer nbl_live_…"
#   claude mcp add --transport http nebula ${MCP_URL} --scope user \\
#     --header "Authorization: Bearer nbl_live_…"`,
    },
    note: `Prefer HTTP for Claude Code — it hits ${MCP_URL} with your token. Stdio fallback (local npx bridge): claude mcp add nebula -e NEBULA_TOKEN=nbl_live_… -e NEBULA_HUB=${HUB} -- npx -y nebulamcp-stdio`,
  },
  "custom-mcp": {
    install: {
      title: "install",
      language: "bash",
      code: `npm install @modelcontextprotocol/sdk
# Mint a token above first (nbl_live_…)`,
    },
    config: {
      title: "remote Streamable HTTP",
      language: "typescript",
      code: `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const token = process.env.NEBULA_TOKEN!; // nbl_live_…

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
    note: `Endpoint: POST ${MCP_URL} with Authorization: Bearer nbl_live_…. Use the www host (apex redirects can drop the Bearer header). OAuth DCR for hosted connectors: /api/oauth/register → /authorize → /oauth/token.`,
  },
  "openai-sdk": {
    install: {
      title: "install",
      language: "bash",
      code: `pip install openai-agents
# Mint a token above first (nbl_live_…)
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
    note: `Stdio bridge: nebulamcp-stdio presents NEBULA_TOKEN to the Hub. Prefer async with MCPServerStdio so the subprocess cleans up. For remote HTTP instead, POST ${MCP_URL} with Bearer nbl_live_… (same as Custom MCP).`,
  },
};

function TestHubSession() {
  const [state, setState] = useState<"idle" | "testing" | "ok">("idle");
  const [latency, setLatency] = useState<number | null>(null);

  const test = async () => {
    setState("testing");
    try {
      const { latencyMs } = await api.testConnection("claude-desktop");
      setLatency(latencyMs);
      setState("ok");
    } catch {
      setState("idle");
      toast.error("Hub session check failed — sign in again", {
        action: { label: "Retry", onClick: () => void test() },
      });
    }
  };

  if (state === "ok") {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-success" role="status">
        <CheckCircle2 className="size-4" aria-hidden />
        Hub session OK{latency != null ? ` (${latency}ms)` : ""} — paste your token into the client next
      </p>
    );
  }

  return (
    <Button variant="outline" onClick={() => void test()} disabled={state === "testing"}>
      {state === "testing" ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Checking…
        </>
      ) : (
        <>
          <PlugZap className="size-4" /> Check Hub session
        </>
      )}
    </Button>
  );
}

function UsdcTrustlineCard() {
  const { ready: privyReady, authenticated } = usePrivy();
  const [ready, setReady] = useState<boolean | null>(null);
  const [faucet, setFaucet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!privyReady || !authenticated) return;
    let cancelled = false;
    void api
      .getUsdcTrustlineStatus()
      .then((s) => {
        if (cancelled) return;
        setReady(s.ready);
        setFaucet(s.faucet);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setReady(false);
        setLoadError(
          error instanceof Error ? error.message : "Could not check trustline",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [privyReady, authenticated]);

  const openTrustline = async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const res = await api.ensureUsdcTrustline();
      setReady(true);
      if (res.faucet) setFaucet(res.faucet);
      toast.success(res.message, {
        description: res.txHash
          ? `tx ${res.txHash.slice(0, 8)}…`
          : undefined,
        action: res.faucet
          ? {
              label: "Open faucet",
              onClick: () => window.open(res.faucet!, "_blank", "noreferrer"),
            }
          : undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "usdc_trustline_failed";
      setLoadError(message);
      toast.error("Couldn't open USDC trustline", {
        description: message,
        action: { label: "Retry", onClick: () => void openTrustline() },
      });
    } finally {
      setBusy(false);
    }
  };

  const waitingAuth = !privyReady || !authenticated;

  return (
    <Card className="space-y-3 p-5">
      <div>
        <p className="text-[13px] font-medium text-muted-foreground">
          USDC for x402 / MPP
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Privy signs a Circle USDC trustline on your Hub wallet — you can&apos;t
          do this in Stellar Lab without the secret key.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {waitingAuth ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Waiting for session…
          </p>
        ) : ready ? (
          <p className="inline-flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" aria-hidden />
            Trustline open
          </p>
        ) : (
          <Button
            onClick={() => void openTrustline()}
            disabled={busy || ready === null}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Opening…
              </>
            ) : (
              "Open USDC trustline"
            )}
          </Button>
        )}
        {faucet ? (
          <a
            href={faucet}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Fund via Circle faucet →
          </a>
        ) : null}
      </div>
      {loadError ? (
        <p className="text-[13px] text-destructive">{loadError}</p>
      ) : null}
    </Card>
  );
}

export default function ConnectPage() {
  return (
    <div>
      <PageHeader
        eyebrow="setup"
        title="Connect"
        subtitle="Mint a token, then wire your client to the Hub. Keys stay in Privy — agents only present nbl_live_…."
      />

      <Card className="mb-6 space-y-2 p-5">
        <p className="text-sm font-medium text-foreground">How MCP connects</p>
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted-foreground">
          <li>
            <span className="text-foreground">Claude Code / custom agents</span>{" "}
            — call the Hub directly at{" "}
            <code className="text-[12px]">{MCP_URL}</code> (Streamable HTTP +
            Bearer token). No local package required.
          </li>
          <li>
            <span className="text-foreground">Claude Desktop / Cursor / OpenAI Agents</span>{" "}
            — run <code className="text-[12px]">npx -y nebulamcp-stdio</code> over
            stdio; it forwards tools to the Hub with your token.
          </li>
          <li>
            Always use the <code className="text-[12px]">www</code> Hub host.
            Apex redirects can strip <code className="text-[12px]">Authorization</code>.
          </li>
        </ul>
      </Card>

      <div className="mb-6">
        <ApiKeysCard />
      </div>

      <Tabs defaultValue="claude-code">
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
            <TabsContent
              key={framework}
              value={framework}
              className="mt-5 data-[state=inactive]:hidden"
              forceMount
            >
              <Card className="space-y-5 p-5">
                <div>
                  <p className="mb-2 text-[13px] font-medium text-muted-foreground">
                    1 · Prerequisites
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
                  <p className="mb-2 text-[13px] font-medium text-muted-foreground">
                    3 · Verify Hub session
                  </p>
                  <p className="mb-2.5 text-[13px] text-muted-foreground">
                    Confirms you&apos;re signed into this Hub. MCP itself is
                    verified in your client (e.g.{" "}
                    <code className="text-[12px]">claude mcp list</code> or a{" "}
                    <code className="text-[12px]">check_balance</code> call).
                  </p>
                  <TestHubSession />
                </div>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="mt-6">
        <UsdcTrustlineCard />
      </div>
    </div>
  );
}
