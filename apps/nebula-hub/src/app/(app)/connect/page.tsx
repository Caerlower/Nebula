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
      code: `# Node 20+. After publish: npx -y nebulamcp
# Local monorepo: pnpm --filter nebulamcp build && node packages/nebulamcp/dist/index.js
node --version`,
    },
    config: {
      title: "claude_desktop_config.json",
      language: "json",
      code: `{
  "mcpServers": {
    "nebula": {
      "command": "npx",
      "args": ["-y", "nebulamcp"],
      "env": {
        "NEBULA_TOKEN": "nbl_live_…",
        "NEBULA_HUB": "https://www.nebulaonchain.xyz"
      }
    }
  }
}`,
    },
    note: "Mint a token below and paste this in. Prefer www for NEBULA_HUB. Private keys never leave Nebula.",
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
  -e NEBULA_TOKEN=nbl_live_… \\
  -e NEBULA_HUB=https://www.nebulaonchain.xyz \\
  -- npx -y nebulamcp

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
      title: "remote Streamable HTTP",
      language: "typescript",
      code: `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("https://www.nebulaonchain.xyz/mcp"),
  {
    requestInit: {
      headers: { Authorization: \`Bearer \${process.env.NEBULA_TOKEN}\` },
    },
  },
);

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(transport);

const balance = await client.callTool({
  name: "check_balance",
  arguments: {},
});
console.log(balance);`,
    },
    note: "Remote MCP speaks Streamable HTTP at /mcp. OAuth DCR is at /api/oauth/register → /authorize → /oauth/token.",
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
        "args": ["-y", "nebulamcp"],
        "env": {
            "NEBULA_TOKEN": os.environ["NEBULA_TOKEN"],
            "NEBULA_HUB": os.environ.get("NEBULA_HUB", "https://www.nebulaonchain.xyz"),
        },
    }
)

agent = Agent(
    name="Treasurer",
    instructions="Manage the wallet. Respect the spending policy.",
    mcp_servers=[nebula],
)

result = Runner.run_sync(agent, "What's my balance?")
print(result.final_output)`,
    },
    note: "Stdio via nebulamcp, or point a remote MCP client at POST /mcp with Bearer nbl_live_…",
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
        subtitle="One server, 22 tools. Your agent is a paste away."
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
            <TabsContent
              key={framework}
              value={framework}
              className="mt-5 data-[state=inactive]:hidden"
              forceMount
            >
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
        <UsdcTrustlineCard />
      </div>

      <div className="mt-6">
        <ApiKeysCard />
      </div>
    </div>
  );
}
