"use client";

import Link from "next/link";

import { SectionRule } from "@/components/design/primitives";
import { ApiKeysCard } from "@/components/shared/api-keys-card";
import { agentAttribution } from "@/components/shared/status-badges";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { truncMiddle } from "@/lib/utils";

export default function ApiKeysPage() {
  const { selectedAgent } = useAgentScope();

  return (
    <div>
      <div className="pb-6">
        <SectionRule>API KEYS</SectionRule>
        <h1 className="page-title">API Keys</h1>
        <p className="mt-3 max-w-xl text-[14px] text-pretty text-muted-foreground">
          Manual tokens and Claude.ai OAuth connectors for this agent. Revoke
          any key to cut that client off immediately — the wallet stays put.
        </p>
      </div>

      {selectedAgent ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="min-w-0">
            <p className="font-mono text-[13px]">{selectedAgent.name}</p>
            <p className="mt-1 font-mono text-[10px] tracking-[0.06em] text-subtle">
              {agentAttribution(selectedAgent).toUpperCase()}
              {selectedAgent.address !== "—"
                ? ` · ${truncMiddle(selectedAgent.address, 4, 4)}`
                : " · PROVISIONING…"}
            </p>
          </div>
          <span className="font-mono text-[9px] tracking-[0.14em] text-subtle">
            PER-AGENT SCOPED
          </span>
        </div>
      ) : null}

      <ApiKeysCard />

      <p className="mt-5 font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
        Wire a token into a client on{" "}
        <Link
          href="/connect"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Connect →
        </Link>
      </p>
    </div>
  );
}
