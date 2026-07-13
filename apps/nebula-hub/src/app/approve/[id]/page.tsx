"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { hubFetch } from "@/lib/hub-session";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shell/wordmark";

type Confirmation = {
  id: string;
  toolName: string;
  summary: string;
  status: string;
  expiresAt: string;
  txHash: string | null;
  input?: {
    destination?: string;
    amount_xlm?: number;
    amount_usdc?: number;
    reason?: string;
  };
};

function reasonHint(summary: string): string | null {
  if (summary.includes("exceeds_daily_cap") || summary.includes("exceeds_per_tx_cap")) {
    return "This is over your USDC spend cap. Raise limits in Policy, then retry — approval cannot bypass the contract.";
  }
  if (summary.includes("new_destination")) {
    return "This destination is not on your whitelist yet, so a human must confirm.";
  }
  return null;
}

export default function ApprovePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();
  const hydrated = useAuthStore((s) => s.hydrated);

  const [conf, setConf] = useState<Confirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const returnTo = `/approve/${params.id}`;

  useEffect(() => {
    if (!ready || !hydrated) return;
    if (authenticated) return;
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [ready, hydrated, authenticated, router, returnTo]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    void (async () => {
      setError(null);
      try {
        const res = await hubFetch(`/api/confirmations/${params.id}`);
        const data = (await res.json()) as Confirmation & { reason?: string };
        if (!res.ok) {
          setError(data.reason ?? "Failed to load confirmation");
          return;
        }
        setConf(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
  }, [ready, authenticated, params.id]);

  async function act(kind: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await hubFetch(`/api/confirmations/${params.id}/${kind}`, {
        method: "POST",
        body: "{}",
      });
      const data = (await res.json()) as {
        status?: string;
        reason?: string;
        tx_hash?: string;
        message?: string;
        explorer_url?: string;
      };
      if (!res.ok) {
        setError(data.reason ?? "Request failed");
        setBusy(false);
        return;
      }
      setConf((c) =>
        c
          ? {
              ...c,
              status: kind === "approve" ? "approved" : "rejected",
              txHash: data.tx_hash ?? c.txHash,
            }
          : c,
      );
      setDoneMessage(
        kind === "approve"
          ? data.message ??
              (data.tx_hash
                ? `Transfer submitted · ${data.tx_hash.slice(0, 12)}…`
                : "Approved")
          : "Rejected — agent was denied this transfer.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
        <Wordmark className="text-[26px]" />
        <h1 className="page-title mt-8 text-[28px]">Sign in to approve</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          An agent needs your confirmation before this transfer can proceed.
        </p>
        <Button className="mt-8" onClick={() => void login()}>
          Sign in
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          Or go to{" "}
          <Link
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="underline-offset-4 hover:underline"
          >
            /login
          </Link>
          .
        </p>
      </div>
    );
  }

  const hint = conf ? reasonHint(conf.summary) : null;
  // presentation only: pull a trailing "(reason_code)" out of the summary text
  const summaryMatch = conf?.summary.match(/^(.*?)\s*\(([a-z0-9_]+)\)\s*$/i);
  const summaryText = summaryMatch?.[1] ?? conf?.summary ?? "";
  const reasonCode = summaryMatch?.[2] ?? null;
  const expired =
    conf?.status === "pending" &&
    conf.expiresAt &&
    new Date(conf.expiresAt).getTime() < Date.now();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <Wordmark className="text-[26px]" />
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Dashboard
        </Link>
      </div>

      <h1 className="page-title mt-8 text-[28px]">Confirm agent action</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Your agent needs a human yes. You're approving this one action — nothing more.
      </p>

      {error ? (
        <p className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!conf && !error ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {conf ? (
        <div className="mt-8 space-y-4">
          <div className="card-edge rounded-2xl border border-border bg-card p-5 shadow-[var(--card-shadow)]">
            <p className="text-[15px] font-medium leading-relaxed">{summaryText}</p>
            {reasonCode ? (
              <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                {reasonCode.replaceAll("_", " ")}
              </span>
            ) : null}
            {hint ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{hint}</p>
            ) : null}
            {conf.input?.amount_usdc != null || conf.input?.amount_xlm != null ? (
              <p className="mt-5 font-mono text-3xl tabular tracking-tight">
                {conf.input?.amount_usdc ?? conf.input?.amount_xlm}
                <span className="ml-2 text-base text-muted-foreground">
                  {conf.input?.amount_usdc != null ? "USDC" : "XLM"}
                </span>
              </p>
            ) : null}
            <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Tool</dt>
                <dd className="font-mono text-xs">{conf.toolName}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="inline-flex items-center gap-1.5 capitalize">
                  <span
                    aria-hidden
                    className={
                      expired || conf.status === "rejected"
                        ? "size-1.5 rounded-full bg-subtle"
                        : conf.status === "approved"
                          ? "size-1.5 rounded-full bg-success"
                          : "size-1.5 animate-pulse rounded-full bg-warning"
                    }
                  />
                  {expired ? "expired" : conf.status}
                </dd>
              </div>
              {conf.input?.destination ? (
                <div>
                  <dt className="text-muted-foreground">Destination</dt>
                  <dd className="mt-1.5 break-all rounded-lg border border-border bg-elevated/50 px-3 py-2 font-mono text-xs leading-relaxed">
                    {conf.input.destination}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          {doneMessage ? (
            <div
              className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
                conf.status === "approved"
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-elevated/40"
              }`}
            >
              {conf.status === "approved" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div>
                <p>{doneMessage}</p>
                {conf.txHash ? (
                  <a
                    className="mt-1 inline-block font-mono text-xs text-primary underline-offset-4 hover:underline"
                    href={`https://stellar.expert/explorer/testnet/tx/${conf.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on explorer
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {conf.status === "pending" && !expired ? (
            <div className="flex gap-3">
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => void act("approve")}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Approve transfer
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => void act("reject")}
              >
                Reject
              </Button>
            </div>
          ) : null}

          {conf.status === "executing" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Executing your approval…
            </p>
          ) : null}

          {expired ? (
            <p className="text-sm text-muted-foreground">
              This confirmation expired. Ask the agent to retry the transfer.
            </p>
          ) : null}

          {(conf.status !== "pending" && conf.status !== "executing") ||
          expired ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/dashboard")}
            >
              Back to dashboard
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
