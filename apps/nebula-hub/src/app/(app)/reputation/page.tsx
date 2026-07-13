"use client";

import { ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { ScoreRing } from "@/components/shared/score-ring";
import { ListSkeleton, StatCardSkeleton } from "@/components/shared/skeletons";
import { Card } from "@/components/ui/card";
import * as api from "@/lib/api";
import { fmtInt, timeAgo } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { cn } from "@/lib/utils";

const CONFIDENCE_BLURB: Record<string, string> = {
  unrated: "No ratings yet — your score appears once clients rate this agent on-chain.",
  low: "Fewer than 5 feedback events — treat the average cautiously.",
  medium: "5–49 feedback events — a usable signal.",
  high: "50+ feedback events — stronger confidence in the average.",
  nascent: "No ratings yet — your score appears once clients rate this agent on-chain.",
  Emerging: "Fewer than 5 feedback events — treat the average cautiously.",
};

export default function ReputationPage() {
  const { data: reputation, loading } = useLoad(() => api.getReputation(), []);

  return (
    <div>
      <PageHeader
        eyebrow="agents"
        accent="gold"
        title="Reputation"
        subtitle="Your on-chain track record — written by the agents you work with."
        actions={
          <a
            href="https://stellar8004.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Stellar8004 explorer <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
      />

      {loading || !reputation ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton className="lg:col-span-2" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="flex flex-col items-center justify-center gap-4 p-6">
              <ScoreRing
                score={reputation.score}
                max={reputation.scoreMax}
                label={`of ${reputation.scoreMax}`}
              />
              <div className="text-center">
                <p className="text-lg font-medium capitalize">{reputation.confidence}</p>
                <p className="mt-2 max-w-60 text-[13px] text-muted-foreground">
                  {CONFIDENCE_BLURB[reputation.confidence] ??
                    CONFIDENCE_BLURB.unrated}
                </p>
                {reputation.stellar8004AgentId != null ? (
                  <p className="mt-3 font-mono text-[13px] text-muted-foreground">
                    Agent #{reputation.stellar8004AgentId}
                  </p>
                ) : (
                  <p className="mt-3 text-[13px] text-muted-foreground">
                    Not registered on-chain
                  </p>
                )}
                {reputation.explorerUrl ? (
                  <a
                    href={reputation.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    View on explorer <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </div>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <p className="text-[13px] font-medium text-muted-foreground">
                Stellar8004 signals
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">avgScore</dt>
                  <dd className="mt-1 font-mono text-xl tabular">
                    <AnimatedNumber value={reputation.score} format={fmtInt} />
                    <span className="text-sm text-muted-foreground">/100</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">feedbackCount</dt>
                  <dd className="mt-1 font-mono text-xl tabular">
                    <AnimatedNumber value={reputation.feedbackCount} format={fmtInt} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">uniqueClients</dt>
                  <dd className="mt-1 font-mono text-xl tabular">
                    <AnimatedNumber value={reputation.uniqueClients} format={fmtInt} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">totalScore</dt>
                  <dd className="mt-1 font-mono text-xl tabular">
                    {reputation.totalScore == null ? (
                      "—"
                    ) : (
                      <AnimatedNumber value={reputation.totalScore} format={fmtInt} />
                    )}
                  </dd>
                </div>
              </dl>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                Read straight from on-chain feedback — Nebula mirrors the chain, it never
                invents a score.
                {reputation.source ? ` Source: ${reputation.source}.` : ""}
              </p>
            </Card>
          </div>

          <div>
            <p className="mb-3 text-[13px] font-medium text-muted-foreground">Breakdown</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {reputation.components.map((component) => (
                <Card key={component.key} className="p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm">{component.label}</p>
                    <p className="font-mono text-sm tabular text-muted-foreground">
                      <AnimatedNumber value={component.score} format={fmtInt} />
                      {component.key === "average" ? "/100" : ""}
                    </p>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-elevated">
                    <div
                      className="h-full rounded-full bg-chart-4 transition-all duration-700"
                      style={{
                        width: `${Math.min(100, (component.score / Math.max(component.max, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                    {component.explainer}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <p className="text-[13px] font-medium text-muted-foreground">Status</p>
            </div>
            {reputation.events.length === 0 ? (
              <ListSkeleton rows={2} className="p-5" />
            ) : (
              <ul className="divide-y divide-border">
                {reputation.events.map((event) => (
                  <li key={event.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span
                      className={cn(
                        "w-10 shrink-0 font-mono text-[13px] tabular",
                        event.delta >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {event.delta >= 0 ? "+" : ""}
                      {event.delta}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{event.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(event.time)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
