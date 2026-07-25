"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { AuthSplash } from "@/components/shared/auth-splash";
import { SectionRule } from "@/components/design/primitives";
import { Wordmark } from "@/components/shell/wordmark";
import { hubFetch } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";

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
  if (
    summary.includes("exceeds_daily_cap") ||
    summary.includes("exceeds_per_tx_cap")
  ) {
    return "This is over your USDC spend cap. Raise limits in Policy, then retry — Hub will not sign spend that fails the on-chain check.";
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
  const walletAuthed = useAuthStore((s) => s.walletAuthed);
  const network = useUIStore((s) => s.network);

  const [conf, setConf] = useState<Confirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const returnTo = `/approve/${params.id}`;
  const authed = (authenticated || walletAuthed) && hydrated;

  useEffect(() => {
    if (!ready || !hydrated) return;
    if (authed) return;
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [ready, hydrated, authed, router, returnTo]);

  useEffect(() => {
    if (!ready || !authed) return;
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
  }, [ready, authed, params.id]);

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
          ? (data.message ??
              (data.tx_hash
                ? `Transfer submitted · ${data.tx_hash.slice(0, 12)}…`
                : "Approved"))
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
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <AuthSplash title="One moment" detail="Loading your session…" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-6 py-12">
        <Wordmark className="text-[22px]" />
        <SectionRule className="mt-10">HUMAN APPROVAL</SectionRule>
        <h1 className="page-title">Sign in to approve</h1>
        <p className="mt-3 text-[14px] text-pretty text-muted-foreground">
          An agent needs your confirmation before this transfer can proceed.
        </p>
        <button
          type="button"
          onClick={() => void login()}
          className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--btn-bg)] px-5 text-[13px] font-medium text-[var(--btn-fg)] transition-opacity hover:opacity-90"
        >
          Sign in
        </button>
        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          Or go to{" "}
          <Link
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            /login
          </Link>
        </p>
      </div>
    );
  }

  const hint = conf ? reasonHint(conf.summary) : null;
  const summaryMatch = conf?.summary.match(/^(.*?)\s*\(([a-z0-9_]+)\)\s*$/i);
  const summaryText = summaryMatch?.[1] ?? conf?.summary ?? "";
  const reasonCode = summaryMatch?.[2] ?? null;
  const expired =
    conf?.status === "pending" &&
    conf.expiresAt &&
    new Date(conf.expiresAt).getTime() < Date.now();
  const amount =
    conf?.input?.amount_usdc != null
      ? { value: conf.input.amount_usdc, unit: "USDC" }
      : conf?.input?.amount_xlm != null
        ? { value: conf.input.amount_xlm, unit: "XLM" }
        : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <Wordmark className="text-[22px]" />
        <Link
          href="/dashboard"
          className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase hover:text-foreground"
        >
          Dashboard
        </Link>
      </div>

      <SectionRule className="mt-10">CONFIRM · AGENT ACTION</SectionRule>
      <h1 className="page-title text-[28px] sm:text-[32px]">
        Confirm transfer
      </h1>
      <p className="mt-3 text-[14px] text-pretty text-muted-foreground">
        Your agent needs a human yes. You&apos;re approving this one action —
        nothing more.
      </p>

      {error ? (
        <p className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      {!conf && !error ? (
        <div className="mt-10 flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {conf ? (
        <div className="mt-8 overflow-hidden soft-panel-lg">
          <div className="border-b border-border px-6 pt-6 pb-5">
            <p className="text-[15px] leading-relaxed font-medium">
              {summaryText}
            </p>
            {reasonCode ? (
              <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] text-warning uppercase">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-warning"
                />
                {reasonCode.replaceAll("_", " ")}
              </span>
            ) : null}
            {hint ? (
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                {hint}
              </p>
            ) : null}
            {amount ? (
              <p className="mt-5 font-mono text-[36px] leading-none tracking-tight tabular">
                {amount.value}
                <span className="ml-2 text-[14px] text-muted-foreground">
                  {amount.unit}
                </span>
              </p>
            ) : null}
          </div>

          <dl className="space-y-4 border-b border-border px-6 py-5">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                Tool
              </dt>
              <dd className="font-mono text-[12px]">{conf.toolName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                Status
              </dt>
              <dd className="inline-flex items-center gap-1.5 text-[13px] capitalize">
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    expired || conf.status === "rejected"
                      ? "bg-subtle"
                      : conf.status === "approved"
                        ? "bg-success"
                        : "animate-pulse bg-warning",
                  )}
                />
                {expired ? "expired" : conf.status}
              </dd>
            </div>
            {conf.input?.destination ? (
              <div>
                <dt className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                  Destination
                </dt>
                <dd className="mt-2 break-all rounded-xl border border-border bg-[var(--panel-3)] px-3.5 py-2.5 font-mono text-[11px] leading-relaxed">
                  {conf.input.destination}
                </dd>
              </div>
            ) : null}
          </dl>

          {doneMessage ? (
            <div
              className={cn(
                "flex items-start gap-2.5 border-b border-border px-6 py-4 text-[13px]",
                conf.status === "approved"
                  ? "bg-success/5 text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {conf.status === "approved" ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden
                />
              ) : (
                <XCircle
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
              <div>
                <p>{doneMessage}</p>
                {conf.txHash ? (
                  <a
                    className="mt-1.5 inline-block font-mono text-[11px] text-primary underline-offset-4 hover:underline"
                    href={`https://stellar.expert/explorer/${network === "mainnet" ? "public" : "testnet"}/tx/${conf.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on explorer
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {conf.status === "executing" ? (
            <p className="flex items-center gap-2 px-6 py-4 text-[13px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Executing your approval…
            </p>
          ) : null}

          {expired ? (
            <p className="px-6 py-4 text-[13px] text-muted-foreground">
              This confirmation expired. Ask the agent to retry the transfer.
            </p>
          ) : null}

          {conf.status === "pending" && !expired ? (
            <div className="flex gap-3 px-6 py-5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("reject")}
                className="h-11 flex-1 rounded-full border border-border bg-[var(--panel-3)] px-5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("approve")}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--btn-bg)] px-5 text-[13px] font-medium text-[var(--btn-fg)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : null}
                {busy ? "Working…" : "Approve transfer"}
              </button>
            </div>
          ) : null}

          {(conf.status !== "pending" && conf.status !== "executing") ||
          expired ? (
            <div className="px-6 py-5">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="h-11 w-full rounded-full border border-border bg-[var(--panel-3)] px-5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              >
                Back to dashboard
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
