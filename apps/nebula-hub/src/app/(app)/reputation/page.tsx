"use client";

import { ExternalLink, MessageSquare, Sigma, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { ScoreRing } from "@/components/shared/score-ring";
import { ListSkeleton, StatCardSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import * as api from "@/lib/api";
import { fmtInt, timeAgo } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { cn } from "@/lib/utils";

const CONFIDENCE_BLURB: Record<string, string> = {
  unrated: "No ratings yet — your score appears once clients rate this agent on-chain.",
  low: "Fewer than 5 feedback events — treat the average cautiously.",
  medium: "5–49 feedback events — a usable signal.",
  high: "50+ feedback events — stronger confidence in the average.",
  nascent: "No ratings yet — your score appears once clients rate this agent on-chain.",
  Emerging: "Fewer than 5 feedback events — treat the average cautiously.",
};

function SignalTile({
  icon: Icon,
  label,
  value,
  suffix,
  explainer,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  suffix?: string;
  explainer: string;
}) {
  return (
    <div className="p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md border border-border bg-elevated/50 text-warm">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <p className="stat-label">{label}</p>
      </div>
      <p className="mt-3 hero-number-sm tabular">
        {value == null ? (
          "—"
        ) : (
          <>
            <AnimatedNumber value={value} format={fmtInt} />
            {suffix ? (
              <span className="text-sm text-muted-foreground">{suffix}</span>
            ) : null}
          </>
        )}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{explainer}</p>
    </div>
  );
}

export default function ReputationPage() {
  const { selectedAgentId } = useAgentScope();
  const { data: reputation, loading } = useLoad(
    () => api.getReputation(),
    [selectedAgentId],
  );

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
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
            <Card
              className={cn(
                "flex flex-col items-center justify-center gap-4 p-6",
                "border-[color-mix(in_srgb,var(--accent-warm)_28%,var(--border))] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--accent-warm)_10%,var(--card))_0%,var(--card)_60%)]",
              )}
            >
              <ScoreRing
                score={reputation.score}
                max={reputation.scoreMax}
                label={`of ${reputation.scoreMax}`}
              />
              <div className="text-center">
                <Badge
                  variant={reputation.registered ? "success" : "outline"}
                  className="capitalize"
                >
                  {reputation.confidence}
                </Badge>
                <p className="mx-auto mt-3 max-w-60 text-[13px] leading-relaxed text-muted-foreground">
                  {CONFIDENCE_BLURB[reputation.confidence] ??
                    CONFIDENCE_BLURB.unrated}
                </p>
                {reputation.stellar8004AgentId != null ? (
                  <p className="mt-3 font-mono text-[13px] text-muted-foreground">
                    Stellar8004 agent #{reputation.stellar8004AgentId}
                  </p>
                ) : (
                  <p className="mt-3 text-[13px] text-muted-foreground">
                    Not registered on-chain yet
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

            <div className="lg:col-span-2">
              <p className="stat-label mb-3">Stellar8004 signals</p>
              <Card className="grid grid-cols-1 divide-y divide-border overflow-hidden sm:grid-cols-2 sm:divide-y-0 sm:[&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(2n)]:border-l">
                <SignalTile
                  icon={Star}
                  label="Average score"
                  value={reputation.score}
                  suffix="/100"
                  explainer="Mean of on-chain feedback, normalized to 0–100."
                />
                <SignalTile
                  icon={MessageSquare}
                  label="Feedback count"
                  value={reputation.feedbackCount}
                  explainer="Non-revoked feedback records left for this agent."
                />
                <SignalTile
                  icon={Users}
                  label="Unique clients"
                  value={reputation.uniqueClients}
                  explainer="Distinct addresses that left feedback (sybil-relevant)."
                />
                <SignalTile
                  icon={Sigma}
                  label="Total score"
                  value={reputation.totalScore}
                  explainer="Explorer aggregate totalScore when indexed; else 0."
                />
              </Card>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                Read straight from on-chain feedback — Nebula mirrors the chain, it
                never invents a score.
                {reputation.source ? ` Source: ${reputation.source}.` : ""}
              </p>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <p className="stat-label">Status</p>
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
