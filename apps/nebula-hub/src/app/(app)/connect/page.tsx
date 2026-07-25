"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { SectionRule } from "@/components/design/primitives";
import { AgentTokensPanel } from "@/components/shared/api-keys-card";
import { FRAMEWORK_META } from "@/components/shared/status-badges";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { getSnippet } from "@/lib/mcp/snippets";
import { cn } from "@/lib/utils";
import type { Framework } from "@/types/domain";

function CopyChip({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="shrink-0 font-mono text-[10px] tracking-[0.12em] text-subtle hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success("Copied");
        } catch {
          toast.error("Couldn't copy");
        }
      }}
    >
      COPY
    </button>
  );
}

export default function ConnectPage() {
  const { selectedAgent } = useAgentScope();
  const [client, setClient] = useState<Framework>("claude-code");
  const [openStep, setOpenStep] = useState(1);
  const [pasted, setPasted] = useState(false);
  const snippet = getSnippet(client);
  const frameworks = Object.keys(FRAMEWORK_META) as Framework[];

  const steps = [
    {
      num: "01",
      title: "Issue an agent token",
      body: "Tokens are scoped to this agent only. Create one on the API Keys page (or Issue new token on the right), then put it in LIVE CONFIG.",
      cta: (
        <Link
          href="/api-keys"
          className="mt-4 inline-flex rounded-full px-5 py-2.5 text-[13px] font-semibold"
          style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
        >
          Open API Keys
        </Link>
      ),
    },
    {
      num: "02",
      title: "Pick your client",
      body: "Claude Code, Claude Desktop, Cursor, OpenAI Agents, or a custom MCP SDK client. LIVE CONFIG updates for the client you pick.",
      cta: (
        <div className="mt-4 flex flex-wrap gap-2">
          {frameworks.map((fw) => {
            const active = fw === client;
            return (
              <button
                key={fw}
                type="button"
                onClick={() => {
                  setClient(fw);
                  setPasted(false);
                }}
                className={cn(
                  "rounded-[10px] border px-3.5 py-2 font-mono text-[10px] tracking-[0.1em]",
                  active
                    ? "border-primary bg-[var(--accent-soft)] text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {FRAMEWORK_META[fw].label.toUpperCase()}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      num: "03",
      title: "Paste the config",
      body: "Copy LIVE CONFIG from the right, drop it into the file for your client, then restart the client.",
      cta: (
        <div className="mt-4 space-y-3">
          {snippet.pasteTargets.map((target) => (
            <div
              key={target.label + target.path}
              className="rounded-xl border border-border bg-[var(--panel-3)] px-4 py-3.5"
            >
              <div className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
                {target.label.toUpperCase()}
              </div>
              <code className="mt-1.5 block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px] text-primary-2">
                {target.path}
              </code>
            </div>
          ))}
          <p className="text-[12px] text-muted-foreground">
            Replace{" "}
            <span className="font-mono text-[11px] text-subtle">nbl_live_…</span>{" "}
            in LIVE CONFIG with the token you just issued, then save and restart.
          </p>
          <button
            type="button"
            onClick={() => {
              setPasted(true);
              toast.success("You're set — restart the client and try a balance check");
            }}
            className="mt-1 inline-flex rounded-full px-5 py-2.5 text-[13px] font-semibold"
            style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
          >
            {pasted ? "Pasted ✓" : "I've pasted it"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="pb-6">
        <SectionRule>CONNECT · MCP</SectionRule>
        <h1 className="page-title">
          Wire {selectedAgent?.name ?? "your agent"} into your client
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="soft-panel px-8 pt-2 pb-7">
          {steps.map((step, i) => {
            const n = i + 1;
            const open = openStep === n;
            const done = openStep > n || (n === 3 && pasted);
            return (
              <div
                key={step.num}
                className="grid grid-cols-[34px_minmax(0,1fr)] gap-[18px] border-b border-border py-6 last:border-b-0"
              >
                <div
                  className={cn(
                    "pt-0.5 font-mono text-[12px]",
                    open
                      ? "text-primary"
                      : done
                        ? "text-muted-foreground"
                        : "text-subtle",
                  )}
                >
                  {step.num}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setOpenStep(n)}
                    className={cn(
                      "block text-left text-[17px] font-semibold tracking-[-0.01em]",
                      open ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </button>
                  {open ? (
                    <div className="mt-3">
                      <p className="max-w-[520px] text-[13px] text-pretty text-muted-foreground">
                        {step.body}
                      </p>
                      {step.cta}
                      {n < steps.length ? (
                        <button
                          type="button"
                          onClick={() => setOpenStep(n + 1)}
                          className="mt-4 inline-flex rounded-full px-5 py-2.5 text-[13px] font-semibold"
                          style={{
                            background: "var(--btn-bg)",
                            color: "var(--btn-fg)",
                          }}
                        >
                          Continue
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="soft-panel bg-elevated px-7 py-7">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
              LIVE CONFIG
            </span>
            <span className="font-mono text-[9px] tracking-[0.12em] text-primary-2">
              UPDATES AS YOU GO
            </span>
          </div>
          <div className="relative mt-4">
            <pre className="overflow-x-auto rounded-xl border border-border bg-[var(--panel-3)] p-[18px] pr-16 font-mono text-[11px] leading-[1.75] break-words whitespace-pre-wrap text-muted-foreground">
              {snippet.config.code}
            </pre>
            <div className="absolute top-3 right-3">
              <CopyChip value={snippet.config.code} />
            </div>
          </div>
          <div className="mt-6 border-t border-border pt-5">
            <AgentTokensPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
