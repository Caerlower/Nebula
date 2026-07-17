"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Coins,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { CodeBlock } from "@/components/shared/code-block";
import { CopyButton } from "@/components/shared/copy-button";
import {
  FRAMEWORK_META,
  FrameworkLabel,
} from "@/components/shared/status-badges";
import { getSnippet } from "@/lib/mcp-snippets";
import { AgentAvatar } from "@/components/agent-scope/agent-avatar";
import { useAgentScope } from "@/components/agent-scope/agent-scope";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import * as api from "@/lib/api";
import type { CreatedAgent } from "@/lib/api/agents";
import { cn } from "@/lib/utils";
import type { Framework } from "@/types/domain";

const COLOR_SWATCHES: { hue: string; label: string }[] = [
  { hue: "265", label: "Violet" },
  { hue: "210", label: "Azure" },
  { hue: "160", label: "Teal" },
  { hue: "130", label: "Green" },
  { hue: "20", label: "Amber" },
  { hue: "330", label: "Rose" },
];

function Perk({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Wallet;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated/60 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function CreateForm({
  onCreated,
}: {
  onCreated: (result: CreatedAgent) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [framework, setFramework] = useState<Framework>("claude-desktop");
  const [color, setColor] = useState<string>("");
  const [perTx, setPerTx] = useState("");
  const [daily, setDaily] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give your agent a name");
      return;
    }
    setBusy(true);
    try {
      const result = await api.createAgent({
        name: name.trim(),
        framework,
        description: description.trim() || undefined,
        avatarColor: color || undefined,
        perTxCapUSD: perTx ? Number(perTx) : null,
        dailyCapUSD: daily ? Number(daily) : null,
      });
      onCreated(result);
    } catch {
      toast.error("Couldn't create the agent", { description: "Please try again." });
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-6">
          <div className="flex items-center gap-3">
            <AgentAvatar name={name || "New agent"} color={color} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {name.trim() || "Your new agent"}
              </p>
              <p className="text-[13px] text-muted-foreground">
                Gets its own wallet, token, caps &amp; reputation.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              placeholder="e.g. Atlas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={40}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-purpose">What is this agent for?</Label>
            <textarea
              id="agent-purpose"
              placeholder="e.g. Pays for research APIs and rebalances the treasury nightly."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
              className="flex w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-border-strong focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-subtle">Optional — helps you tell agents apart.</p>
          </div>

          <div className="space-y-2">
            <Label>Framework</Label>
            <RadioGroup
              value={framework}
              onValueChange={(v) => setFramework(v as Framework)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {(Object.keys(FRAMEWORK_META) as Framework[]).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm transition-colors has-[[data-state=checked]]:border-primary/60 has-[[data-state=checked]]:bg-elevated"
                >
                  <RadioGroupItem value={key} aria-label={FRAMEWORK_META[key].label} />
                  <FrameworkLabel framework={key} />
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Avatar color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_SWATCHES.map((s) => (
                <button
                  key={s.hue}
                  type="button"
                  aria-label={s.label}
                  aria-pressed={color === s.hue}
                  onClick={() => setColor(color === s.hue ? "" : s.hue)}
                  className={cn(
                    "size-8 rounded-lg ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-105",
                    color === s.hue ? "ring-primary" : "ring-transparent",
                  )}
                  style={{
                    backgroundImage: `linear-gradient(135deg, hsl(${s.hue} 72% 55%), hsl(${(Number(s.hue) + 42) % 360} 70% 45%))`,
                  }}
                />
              ))}
              <span className="text-[11px] text-subtle">Optional</span>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
              <p className="text-sm font-medium">Starting spend caps</p>
              <span className="text-[11px] text-subtle">Optional — change anytime in Policy</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cap-pertx" className="text-[13px] text-muted-foreground">
                  Per transaction (USD)
                </Label>
                <Input
                  id="cap-pertx"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 5"
                  value={perTx}
                  onChange={(e) => setPerTx(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-daily" className="text-[13px] text-muted-foreground">
                  Daily (USD)
                </Label>
                <Input
                  id="cap-daily"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 50"
                  value={daily}
                  onChange={(e) => setDaily(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Provisioning wallet &amp; token…
              </>
            ) : (
              <>
                Create agent <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <p className="text-[13px] font-medium text-muted-foreground">
            What your agent gets
          </p>
          <Perk icon={Wallet} title="Its own Stellar wallet">
            A dedicated, Nebula-managed wallet — isolated from you and every other
            agent. Fund it to enable autonomous spends.
          </Perk>
          <Perk icon={KeyRound} title="A scoped API token">
            An <code className="text-[12px]">nbl_live_</code> key that authenticates as
            only this agent and touches only this wallet.
          </Perk>
          <Perk icon={ShieldCheck} title="Independent spend policy">
            Per-transaction and daily caps enforced on every spend, editable later.
          </Perk>
          <Perk icon={Sparkles} title="Its own reputation identity">
            An on-chain Stellar8004 identity it earns over time — separate from your
            other agents.
          </Perk>
        </Card>
      </div>
    </div>
  );
}

function SuccessStep({ result }: { result: CreatedAgent }) {
  const router = useRouter();
  const { agent, token, walletAddress } = result;
  const [saved, setSaved] = useState(false);

  const snippet = getSnippet(agent.framework, token);
  const frameworkLabel = FRAMEWORK_META[agent.framework].label;
  const friendbotUrl = walletAddress
    ? `https://friendbot.stellar.org/?addr=${encodeURIComponent(walletAddress)}`
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <AgentAvatar name={agent.name} color={agent.avatarColor} seed={agent.id} size="lg" />
          <div className="min-w-0">
            <p className="text-lg font-semibold">{agent.name} is live</p>
            <div className="mt-0.5">
              <FrameworkLabel framework={agent.framework} />
            </div>
          </div>
        </div>
      </Card>

      {/* 1 · token — the one-time secret comes first */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" aria-hidden />
          <p className="text-sm font-medium">Scoped API token</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-elevated/60 px-3 py-2.5">
          <code className="min-w-0 flex-1 break-all font-mono text-[13px]">{token}</code>
          <CopyButton value={token} label="Copy API token" />
        </div>
        <div
          className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[13px]"
          role="alert"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            Shown once — copy it now. We store a hash, not the key, so it can&apos;t be
            shown again. Lost it? Mint a fresh key anytime from this agent&apos;s{" "}
            <button
              type="button"
              onClick={() => router.push("/api-keys")}
              className="font-medium text-foreground underline underline-offset-4"
            >
              API Keys
            </button>
            .
          </p>
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-[13px] transition-colors has-[:checked]:border-success/50 has-[:checked]:bg-success/5">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="size-4 accent-[var(--success)]"
          />
          I&apos;ve saved this token somewhere safe.
        </label>
      </Card>

      {/* 2 · wallet + fund */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" aria-hidden />
          <p className="text-sm font-medium">Its own wallet</p>
        </div>
        {walletAddress ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated/60 px-3 py-2.5">
            <code className="min-w-0 flex-1 break-all font-mono text-[13px]">
              {walletAddress}
            </code>
            <CopyButton value={walletAddress} label="Copy agent wallet address" />
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Wallet is still provisioning — it&apos;ll appear in the workspace shortly.
          </p>
        )}
        <p className="text-[13px] text-muted-foreground">
          This agent pays for everything in USDC — fund it with USDC, plus a little XLM
          for network fees.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!friendbotUrl}
            onClick={() =>
              friendbotUrl && window.open(friendbotUrl, "_blank", "noreferrer")
            }
          >
            <Coins className="size-4" /> Get testnet XLM
            <ExternalLink className="size-3.5 opacity-60" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open("https://faucet.circle.com/", "_blank", "noreferrer")
            }
          >
            <Coins className="size-4" /> USDC faucet
            <ExternalLink className="size-3.5 opacity-60" />
          </Button>
        </div>
        <p className="text-[11px] text-subtle">
          Open the agent&apos;s USDC trustline from its Dashboard before receiving USDC.
        </p>
      </Card>

      {/* 3 · client-matched config with the real token baked in */}
      <Card className="space-y-3 p-5">
        <p className="text-sm font-medium">Config for {frameworkLabel}</p>
        <CodeBlock
          code={snippet.config.code}
          language={snippet.config.language}
          title={snippet.config.title}
        />
        <p className="text-[13px] text-muted-foreground">
          Setup details &amp; other clients live in the agent&apos;s Connect tab.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!saved} onClick={() => router.push("/dashboard")}>
          Open {agent.name}&apos;s workspace <ArrowRight className="size-4" />
        </Button>
        <Button
          variant="outline"
          disabled={!saved}
          onClick={() => router.push("/connect")}
        >
          Set up MCP
        </Button>
        <Button variant="ghost" onClick={() => router.push("/api-keys")}>
          <KeyRound className="size-4" /> Manage keys
        </Button>
        {!saved ? (
          <span className="text-[13px] text-muted-foreground">
            Confirm you&apos;ve saved the token to continue.
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function NewAgentPage() {
  const router = useRouter();
  const { hasAgents, reloadAgents, setSelectedAgentId } = useAgentScope();
  const [result, setResult] = useState<CreatedAgent | null>(null);

  const onCreated = (created: CreatedAgent) => {
    setResult(created);
    setSelectedAgentId(created.agent.id);
    reloadAgents();
  };

  const firstAgent = !hasAgents && !result;

  return (
    <div>
      <PageHeader
        eyebrow={result ? "agent created" : firstAgent ? "get started" : "new agent"}
        title={
          result
            ? "Your agent is ready"
            : firstAgent
              ? "Create your first agent"
              : "Create an agent"
        }
        subtitle={
          result
            ? "This is the infrastructure your autonomous agent runs on."
            : "Stand up autonomous payment infrastructure — its own wallet, token, spend caps, and reputation identity."
        }
        actions={
          !result && hasAgents ? (
            <Button variant="ghost" onClick={() => router.push("/agents")}>
              <ArrowLeft className="size-4" /> Back to agents
            </Button>
          ) : undefined
        }
      />
      {result ? <SuccessStep result={result} /> : <CreateForm onCreated={onCreated} />}
    </div>
  );
}
