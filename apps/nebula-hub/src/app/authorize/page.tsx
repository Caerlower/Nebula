"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { hubFetch } from "@/lib/hub-session";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shell/wordmark";
import { useAuthStore } from "@/stores/auth";
import { cn, truncMiddle } from "@/lib/utils";

type AgentOption = {
  id: string;
  name: string;
  stellarAddress: string | null;
  framework: string;
};

function AuthorizeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, authenticated } = usePrivy();
  const hydrated = useAuthStore((s) => s.hydrated);
  const walletAuthed = useAuthStore((s) => s.walletAuthed);
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<AgentOption[] | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  // Privy (email/OAuth) or Freighter wallet session both count.
  const authed = (authenticated || walletAuthed) && hydrated;

  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const challenge = params.get("code_challenge") ?? "";
  const method = params.get("code_challenge_method") ?? "S256";
  const state = params.get("state") ?? "";
  const scope = params.get("scope") ?? "mcp";

  const valid = useMemo(
    () =>
      Boolean(clientId && redirectUri && challenge && method === "S256"),
    [clientId, redirectUri, challenge, method],
  );

  const returnToLogin = useMemo(() => {
    const returnTo = `/authorize?${params.toString()}`;
    return `/login?returnTo=${encodeURIComponent(returnTo)}`;
  }, [params]);

  useEffect(() => {
    if (!ready || !hydrated) return;
    if (authed) return;
    router.replace(returnToLogin);
  }, [ready, hydrated, authed, router, returnToLogin]);

  // Load this account's agents so the user picks which wallet Claude will use.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await hubFetch("/api/agents");
        const data = (await res.json()) as { agents?: AgentOption[] };
        if (cancelled) return;
        const list = (data.agents ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          stellarAddress: a.stellarAddress,
          framework: a.framework,
        }));
        setAgents(list);
        const readyAgents = list.filter((a) => a.stellarAddress);
        if (readyAgents.length === 1) {
          setSelectedAgentId(readyAgents[0]!.id);
        }
      } catch {
        if (!cancelled) setAgents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed]);

  const selected = agents?.find((a) => a.id === selectedAgentId) ?? null;
  const canAllow = valid && Boolean(selected?.stellarAddress) && !busy;

  const approve = async () => {
    if (!valid || !selectedAgentId) {
      toast.error(
        !selectedAgentId
          ? "Pick an agent for this connector"
          : "Invalid authorize request",
      );
      return;
    }
    setBusy(true);
    try {
      const res = await hubFetch("/api/oauth/consent", {
        method: "POST",
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: challenge,
          code_challenge_method: "S256",
          state: state || undefined,
          scope,
          agent_id: selectedAgentId,
        }),
      });
      const data = (await res.json()) as {
        redirect_to?: string;
        error_description?: string;
        error?: string;
      };
      if (!res.ok || !data.redirect_to) {
        throw new Error(data.error_description ?? data.error ?? "consent_failed");
      }
      window.location.assign(data.redirect_to);
    } catch (error) {
      toast.error("Couldn't authorize", {
        description: error instanceof Error ? error.message : String(error),
      });
      setBusy(false);
    }
  };

  if (!ready || !hydrated) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
        <Wordmark className="text-[26px]" />
        <h1 className="page-title mt-8 text-[28px]">Sign in to continue</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          An MCP client wants access to a Nebula agent wallet.
        </p>
        <Button className="mt-8" asChild>
          <Link href={returnToLogin}>Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Wordmark className="text-[26px]" />
      <h1 className="page-title mt-8 text-[28px]">Authorize MCP access</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Pick which agent this Claude connector will use. Tools will run on that
        agent&apos;s managed wallet — not your login wallet.
      </p>

      <div className="mt-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-subtle">
          Agent
        </p>
        {agents === null ? (
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading agents…
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground">
            No agents yet.{" "}
            <Link
              href="/agents/new"
              className="text-foreground underline-offset-4 hover:underline"
            >
              Create one
            </Link>{" "}
            first, then come back and reconnect.
          </div>
        ) : (
          <ul className="space-y-2">
            {agents.map((agent) => {
              const readyWallet = Boolean(agent.stellarAddress);
              const active = agent.id === selectedAgentId;
              return (
                <li key={agent.id}>
                  <button
                    type="button"
                    disabled={!readyWallet}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                      active
                        ? "border-border-strong bg-elevated shadow-[inset_2px_0_0_var(--primary)]"
                        : "border-border hover:bg-elevated/50",
                      !readyWallet && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-teal text-white">
                      <Bot className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {agent.name}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                        {agent.stellarAddress
                          ? truncMiddle(agent.stellarAddress, 6, 6)
                          : "Wallet still provisioning…"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <dl className="mt-6 space-y-3 rounded-lg border border-border p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Client</dt>
          <dd className="mt-0.5 break-all font-mono text-xs">
            {clientId || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Scope</dt>
          <dd className="mt-0.5">{scope}</dd>
        </div>
      </dl>

      {!valid ? (
        <p className="mt-4 text-sm text-destructive">
          Missing client_id, redirect_uri, or S256 code_challenge.
        </p>
      ) : null}

      <div className="mt-8 flex gap-3">
        <Button
          className="flex-1"
          disabled={!canAllow}
          onClick={() => void approve()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Allow {selected ? selected.name : "agent"}
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={() => router.replace("/agents")}
        >
          Deny
        </Button>
      </div>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthorizeInner />
    </Suspense>
  );
}
