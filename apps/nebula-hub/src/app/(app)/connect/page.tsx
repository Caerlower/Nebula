"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, KeyRound, Loader2, PlugZap } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { CodeBlock } from "@/components/shared/code-block";
import { FRAMEWORK_META } from "@/components/shared/status-badges";
import { AgentAvatar } from "@/components/agent-scope/agent-avatar";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import * as api from "@/lib/api";
import { MCP_URL, getSnippet } from "@/lib/mcp-snippets";
import { cn, truncMiddle } from "@/lib/utils";
import type { Framework } from "@/types/domain";

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

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border bg-elevated text-[11px] font-semibold text-muted-foreground">
        {n}
      </span>
      <p className="text-sm font-medium">{title}</p>
    </div>
  );
}

export default function ConnectPage() {
  const { selectedAgent } = useAgentScope();
  const [client, setClient] = useState<Framework>("claude-code");
  const snippet = getSnippet(client);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="setup"
        title="Connect"
        subtitle="Pick your client and paste in the ready-made config. Each config uses a token scoped to this agent only."
      />

      {/* slim identity strip */}
      {selectedAgent ? (
        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3">
          <AgentAvatar
            name={selectedAgent.name}
            seed={selectedAgent.id}
            color={selectedAgent.avatarColor}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Connecting {selectedAgent.name}</p>
            {selectedAgent.address !== "—" ? (
              <p className="font-mono text-xs text-muted-foreground">
                {truncMiddle(selectedAgent.address, 6, 6)}
              </p>
            ) : null}
          </div>
          <span className="rounded-full border border-border bg-elevated/60 px-2.5 py-1 text-[11px] text-muted-foreground">
            per-agent scoped
          </span>
        </div>
      ) : null}

      {/* choose client */}
      <section className="mb-8">
        <p className="stat-label mb-3">Choose your client</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(Object.keys(FRAMEWORK_META) as Framework[]).map((framework) => {
            const Icon = FRAMEWORK_META[framework].icon;
            const active = framework === client;
            return (
              <button
                key={framework}
                type="button"
                onClick={() => setClient(framework)}
                aria-pressed={active}
                className={cn(
                  "pressable flex flex-col items-center gap-2 rounded-xl border p-3 text-center",
                  active
                    ? "border-primary/60 bg-elevated text-foreground shadow-[var(--card-shadow)]"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "text-primary")} aria-hidden />
                <span className="text-[11px] font-medium leading-tight">
                  {FRAMEWORK_META[framework].label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* sequential steps for the chosen client */}
      <Card key={client} className="rise-in space-y-8 p-6">
        <div className="space-y-3">
          <StepHeading n={1} title="Prerequisites" />
          <div className="pl-9">
            <CodeBlock
              code={snippet.install.code}
              language={snippet.install.language}
              title={snippet.install.title}
            />
          </div>
        </div>

        <div className="space-y-3">
          <StepHeading n={2} title="Get this agent's token" />
          <div className="space-y-3 pl-9">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Paste an <code className="text-[12px]">nbl_live_</code> key scoped to{" "}
              {selectedAgent ? selectedAgent.name : "this agent"} into the config below.
              It authenticates as this agent only and operates only its wallet.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/api-keys">
                <KeyRound className="size-4" aria-hidden />
                Manage this agent&apos;s keys
              </Link>
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <StepHeading n={3} title="Configure" />
          <div className="pl-9">
            <CodeBlock
              code={snippet.config.code}
              language={snippet.config.language}
              title={snippet.config.title}
            />
            <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
              {snippet.note}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <StepHeading n={4} title="Verify Hub session" />
          <div className="space-y-2.5 pl-9">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Confirms you&apos;re signed into this Hub. MCP itself is verified in your
              client (e.g. <code className="text-[12px]">claude mcp list</code> or a{" "}
              <code className="text-[12px]">check_balance</code> call).
            </p>
            <TestHubSession />
          </div>
        </div>
      </Card>

      {/* advanced / details — collapsed by default so it never competes with the flow */}
      <details className="group mt-6 rounded-xl border border-border bg-surface/40">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium">
          Details &amp; advanced
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="space-y-6 border-t border-border p-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">How MCP connects</p>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted-foreground">
              <li>
                <span className="text-foreground">Claude Code / custom agents</span> —
                call the Hub directly at <code className="text-[12px]">{MCP_URL}</code>{" "}
                (Streamable HTTP + Bearer token).
              </li>
              <li>
                <span className="text-foreground">Claude Desktop / Cursor / OpenAI</span>{" "}
                — run <code className="text-[12px]">npx -y nebulamcp-stdio</code> over
                stdio.
              </li>
              <li>
                Always use the <code className="text-[12px]">www</code> host — apex
                redirects can strip <code className="text-[12px]">Authorization</code>.
              </li>
              <li>
                Agents transact in USDC — open the agent&apos;s USDC trustline from its{" "}
                <Link
                  href="/dashboard"
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Dashboard
                </Link>
                .
              </li>
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}
