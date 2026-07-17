"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ApiKeysCard } from "@/components/shared/api-keys-card";
import { AgentAvatar } from "@/components/agent-scope/agent-avatar";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { Card } from "@/components/ui/card";
import { truncMiddle } from "@/lib/utils";

export default function ApiKeysPage() {
  const { selectedAgent } = useAgentScope();

  return (
    <div>
      <PageHeader
        eyebrow="agent"
        title="API Keys"
        subtitle="Keys are scoped to this agent — each nbl_live_ token authenticates as this agent only and operates only its wallet."
      />

      {selectedAgent ? (
        <Card className="mb-6 flex flex-wrap items-center gap-3 p-4">
          <AgentAvatar
            name={selectedAgent.name}
            seed={selectedAgent.id}
            color={selectedAgent.avatarColor}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{selectedAgent.name}</p>
            {selectedAgent.address !== "—" ? (
              <p className="font-mono text-xs text-muted-foreground">
                {truncMiddle(selectedAgent.address, 6, 6)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">wallet provisioning…</p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated/60 px-2.5 py-1 text-[11px] text-muted-foreground">
            <KeyRound className="size-3" aria-hidden />
            per-agent scoped
          </span>
        </Card>
      ) : null}

      <ApiKeysCard />

      <p className="mt-4 text-[13px] text-muted-foreground">
        Ready to wire this key into a client?{" "}
        <Link
          href="/connect"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Set up MCP →
        </Link>
      </p>
    </div>
  );
}
