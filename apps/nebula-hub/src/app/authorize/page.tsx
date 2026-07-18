"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { hubFetch } from "@/lib/hub-session";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shell/wordmark";
import { useAuthStore } from "@/stores/auth";

function AuthorizeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, authenticated } = usePrivy();
  const hydrated = useAuthStore((s) => s.hydrated);
  const walletAuthed = useAuthStore((s) => s.walletAuthed);
  const [busy, setBusy] = useState(false);

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
    // Send users through Hub login, then back here (AuthRedirect honors returnTo).
    router.replace(returnToLogin);
  }, [ready, hydrated, authed, router, returnToLogin]);

  const approve = async () => {
    if (!valid) {
      toast.error("Invalid authorize request");
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
          An MCP client wants access to your Nebula wallet tools.
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
        Allow this client to call Nebula tools on your behalf using a Hub token.
        Private keys never leave Nebula.
      </p>
      <dl className="mt-8 space-y-3 rounded-lg border border-border p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Client</dt>
          <dd className="mt-0.5 break-all font-mono text-xs">{clientId || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Redirect</dt>
          <dd className="mt-0.5 break-all font-mono text-xs">
            {redirectUri || "—"}
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
          disabled={!valid || busy}
          onClick={() => void approve()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Allow
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={() => router.replace("/dashboard")}
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
