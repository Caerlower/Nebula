"use client";

import Link from "next/link";

import { SectionRule } from "@/components/design/primitives";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { ListSkeleton, StatCardSkeleton } from "@/components/shared/skeletons";
import { useLoad } from "@/hooks/use-load";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import * as api from "@/lib/api";
import { fmtInt, timeAgo } from "@/lib/utils";

const TIER_LABEL: Record<string, string> = {
  unrated: "UNRATED",
  low: "EMERGING",
  medium: "RELIABLE",
  high: "TRUSTED",
  nascent: "UNRATED",
  Emerging: "EMERGING",
  Established: "RELIABLE",
  Trusted: "TRUSTED",
  Elite: "ELITE",
};

export default function ReputationPage() {
  const { selectedAgentId, selectedAgent } = useAgentScope();
  const { data: reputation, loading } = useLoad(
    () => api.getReputation(),
    [selectedAgentId],
  );

  const hasScore = reputation && (reputation.registered || reputation.score > 0);
  const max = reputation?.scoreMax ?? 1000;
  const tier =
    reputation != null
      ? (TIER_LABEL[reputation.confidence] ?? String(reputation.confidence).toUpperCase())
      : "UNRATED";

  return (
    <div>
      <div className="pb-6">
        <SectionRule>REPUTATION · STELLAR8004</SectionRule>
        <h1 className="page-title">
          How counterparties see {selectedAgent?.name ?? "this agent"}
        </h1>
      </div>

      {loading || !reputation ? (
        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : !hasScore ? (
        <div className="soft-panel-lg px-10 py-24 text-center">
          <p className="text-[clamp(2.5rem,8vw,5.125rem)] font-semibold tracking-[-0.022em] leading-[1.1] text-subtle">
            Unrated
          </p>
          <p className="mx-auto mt-5 max-w-md text-[15px] text-pretty text-muted-foreground">
            This agent needs settled payments before Stellar8004 issues a score. It has{" "}
            {reputation.feedbackCount} feedback events so far.
          </p>
          <Link
            href="/transactions"
            className="mt-7 inline-flex rounded-full px-[26px] py-3 text-[13px] font-semibold"
            style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
          >
            See settled payments
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="soft-panel px-8 py-8">
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
              ON-CHAIN SCORE
            </p>
            <div className="mt-3.5 flex items-baseline gap-2.5">
              <span className="font-mono text-[72px] leading-none tracking-[-0.05em] tabular-nums">
                <AnimatedNumber value={reputation.score} format={fmtInt} />
              </span>
              <span className="font-mono text-[13px] text-subtle">/ {max}</span>
            </div>
            <div className="mt-5 h-1.5 bg-border">
              <div
                className="h-1.5 bg-primary transition-[width] duration-700"
                style={{ width: `${Math.min(100, (reputation.score / max) * 100)}%` }}
              />
            </div>
            <p className="mt-3 font-mono text-[11px] tracking-[0.12em] text-primary-2">
              {tier}
            </p>
            <p className="mt-5 text-[13px] text-pretty text-muted-foreground">
              Attested from settled payments, disputes, and channel history. Counterparties on
              x402 and MPP read this before they extend credit.
            </p>
            {reputation.explorerUrl ? (
              <a
                href={reputation.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block font-mono text-[10px] tracking-[0.12em] text-muted-foreground hover:text-foreground"
              >
                STELLAR8004 EXPLORER ↗
              </a>
            ) : null}
          </div>

          <div className="soft-panel px-8 py-8">
            <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
              SIGNALS
            </p>
            {loading ? (
              <ListSkeleton rows={6} className="mt-4" />
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                {[
                  {
                    label: "SETTLEMENT RATE",
                    val:
                      reputation.averageScore != null
                        ? `${reputation.averageScore.toFixed(1)}`
                        : "—",
                    note: `${reputation.feedbackCount} EVENTS`,
                  },
                  {
                    label: "DELTA · 7D",
                    val:
                      reputation.deltaWeek === 0
                        ? "0"
                        : `${reputation.deltaWeek > 0 ? "+" : ""}${reputation.deltaWeek}`,
                    note: "SCORE",
                  },
                  {
                    label: "COUNTERPARTIES",
                    val: String(reputation.uniqueClients ?? 0),
                    note: "UNIQUE",
                  },
                  {
                    label: "TOTAL SCORE",
                    val:
                      reputation.totalScore != null
                        ? String(reputation.totalScore)
                        : "—",
                    note: "",
                  },
                  {
                    label: "LAST EVENT",
                    val: reputation.events[0]
                      ? timeAgo(reputation.events[0].time).toUpperCase()
                      : "—",
                    note: "",
                  },
                  {
                    label: "FEEDBACK",
                    val: String(reputation.feedbackCount),
                    note: "TOTAL",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-baseline justify-between gap-3 border-b border-border py-3.5"
                  >
                    <span className="font-mono text-[11px] tracking-[0.05em] text-muted-foreground">
                      {s.label}
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-[15px] tabular-nums">{s.val}</span>
                      {s.note ? (
                        <span className="font-mono text-[10px] text-subtle">{s.note}</span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
