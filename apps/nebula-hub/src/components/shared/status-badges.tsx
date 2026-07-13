"use client";

import {
  ArrowRightLeft,
  Blocks,
  Layers,
  MonitorDot,
  Radio,
  Shield,
  SquareTerminal,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AgentStatus, Framework, TxStatus, TxType } from "@/types/domain";
import { cn } from "@/lib/utils";

/* ------------------------------ status dot ------------------------------ */

export function StatusDot({
  tone,
  pulse = false,
  className,
}: {
  tone: "success" | "warning" | "destructive" | "muted";
  pulse?: boolean;
  className?: string;
}) {
  const toneClass = {
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    muted: "bg-subtle",
  }[tone];
  return (
    <span
      aria-hidden
      className={cn("inline-block size-1.5 shrink-0 rounded-full", toneClass, pulse && "animate-pulse", className)}
    />
  );
}

/* ------------------------------ agent status ---------------------------- */

export const AGENT_STATUS_META: Record<
  AgentStatus,
  { label: string; tone: "success" | "warning" | "muted" }
> = {
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  offline: { label: "Offline", tone: "muted" },
};

const BADGE_TONE_CLASS = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-elevated/60 text-muted-foreground",
} as const;

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const meta = AGENT_STATUS_META[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", BADGE_TONE_CLASS[meta.tone])}>
      <StatusDot tone={meta.tone} pulse={status === "active"} />
      {meta.label}
    </Badge>
  );
}

/* -------------------------------- tx status ----------------------------- */

export const TX_STATUS_META: Record<
  TxStatus,
  { label: string; tone: "success" | "warning" | "destructive" }
> = {
  confirmed: { label: "Confirmed", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  failed: { label: "Failed", tone: "destructive" },
};

export function TxStatusBadge({ status }: { status: TxStatus }) {
  const meta = TX_STATUS_META[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", BADGE_TONE_CLASS[meta.tone])}>
      <StatusDot tone={meta.tone} pulse={status === "pending"} />
      {meta.label}
    </Badge>
  );
}

/* --------------------------------- tx type ------------------------------ */

export const TX_TYPE_META: Record<TxType, { label: string; icon: LucideIcon }> = {
  x402: { label: "x402", icon: Zap },
  mpp: { label: "MPP", icon: Radio },
  blend_deposit: { label: "Blend deposit", icon: Layers },
  blend_withdraw: { label: "Blend withdraw", icon: Layers },
  transfer: { label: "Transfer", icon: ArrowRightLeft },
  policy_change: { label: "Policy change", icon: Shield },
};

export function TxTypeLabel({ type }: { type: TxType }) {
  const meta = TX_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      {meta.label}
    </span>
  );
}

/* -------------------------------- framework ----------------------------- */

export const FRAMEWORK_META: Record<Framework, { label: string; icon: LucideIcon }> = {
  "claude-desktop": { label: "Claude Desktop", icon: MonitorDot },
  "claude-code": { label: "Claude Code", icon: SquareTerminal },
  "custom-mcp": { label: "Custom MCP", icon: Blocks },
  "openai-sdk": { label: "OpenAI SDK", icon: Layers },
};

export function FrameworkLabel({ framework }: { framework: Framework }) {
  const meta = FRAMEWORK_META[framework];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      {meta.label}
    </span>
  );
}
