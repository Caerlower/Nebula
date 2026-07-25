"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthSplash } from "@/components/shared/auth-splash";
import { SectionRule } from "@/components/design/primitives";
import { Wordmark } from "@/components/shell/wordmark";
import { hubFetch } from "@/lib/auth/session";
import { cn, truncMiddle } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

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
        throw new Error(
          data.error_description ?? data.error ?? "consent_failed",
        );
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
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <AuthSplash title="One moment" detail="Loading your session…" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-6 py-12">
        <Wordmark className="text-[22px]" />
        <SectionRule className="mt-10">MCP CONNECTOR</SectionRule>
        <h1 className="page-title">Sign in to continue</h1>
        <p className="mt-3 text-[14px] text-pretty text-muted-foreground">
          An MCP client wants access to a Nebula agent wallet.
        </p>
        <Link
          href={returnToLogin}
          className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--btn-bg)] px-5 text-[13px] font-medium text-[var(--btn-fg)] transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-6 py-12">
      <Wordmark className="text-[22px]" />
      <SectionRule className="mt-10">MCP CONNECTOR</SectionRule>
      <h1 className="page-title text-[28px] sm:text-[32px]">
        Authorize access
      </h1>
      <p className="mt-3 text-[14px] text-pretty text-muted-foreground">
        Pick which agent this Claude connector will use. Tools run on that
        agent&apos;s managed wallet — not your login wallet.
      </p>

      <div className="mt-8 overflow-hidden soft-panel-lg">
        <div className="border-b border-border px-6 pt-6 pb-5">
          <p className="mb-3.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            Agent
          </p>
          {agents === null ? (
            <div className="flex items-center gap-2 py-3 text-[13px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Loading agents…
            </div>
          ) : agents.length === 0 ? (
            <p className="py-1 text-[13px] text-muted-foreground">
              No agents yet.{" "}
              <Link
                href="/agents/new"
                className="text-foreground underline-offset-4 hover:underline"
              >
                Create one
              </Link>{" "}
              first, then come back and reconnect.
            </p>
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
                        "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                        active
                          ? "border-border-strong bg-[var(--panel-3)]"
                          : "border-border hover:border-border-strong",
                        !readyWallet && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          active ? "bg-primary" : "bg-subtle",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium">
                          {agent.name}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
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

        <dl className="space-y-4 border-b border-border px-6 py-5">
          <div>
            <dt className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
              Client
            </dt>
            <dd className="mt-1.5 break-all font-mono text-[11px] leading-relaxed">
              {clientId || "—"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
              Scope
            </dt>
            <dd className="font-mono text-[12px]">{scope}</dd>
          </div>
        </dl>

        {!valid ? (
          <p className="border-b border-border px-6 py-4 text-[13px] text-destructive">
            Missing client_id, redirect_uri, or S256 code_challenge.
          </p>
        ) : null}

        <div className="flex gap-3 px-6 py-5">
          <button
            type="button"
            disabled={busy}
            onClick={() => router.replace("/agents")}
            className="h-11 flex-1 rounded-full border border-border bg-[var(--panel-3)] px-5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
          >
            Deny
          </button>
          <button
            type="button"
            disabled={!canAllow}
            onClick={() => void approve()}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--btn-bg)] px-5 text-[13px] font-medium text-[var(--btn-fg)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            {busy
              ? "Working…"
              : selected
                ? `Allow ${selected.name}`
                : "Allow agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <AuthSplash title="One moment" detail="Loading…" />
        </div>
      }
    >
      <AuthorizeInner />
    </Suspense>
  );
}
