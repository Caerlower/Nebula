"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

import { Wordmark } from "@/components/shell/wordmark";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import { truncMiddle } from "@/lib/utils";
import { applyPrivySession } from "@/lib/hub-session";
import { cn } from "@/lib/utils";
import type { Framework } from "@/types/domain";
import { FRAMEWORK_META } from "@/components/shared/status-badges";
import { useAuthStore } from "@/stores/auth";

const STEPS = ["Agent", "Framework", "Fund", "Policy"] as const;

const FRAMEWORKS: Framework[] = ["claude-desktop", "claude-code", "custom-mcp", "openai-sdk"];

const POLICY_PRESETS = [
  { key: "conservative", label: "Conservative", capUSD: 10, blurb: "Careful by default — $10/day." },
  { key: "balanced", label: "Balanced", capUSD: 100, blurb: "Room to work — $100/day." },
  { key: "aggressive", label: "Aggressive", capUSD: 1000, blurb: "High throughput — $1,000/day." },
  { key: "custom", label: "Custom", capUSD: null, blurb: "Pick your own daily cap." },
] as const;

type PresetKey = (typeof POLICY_PRESETS)[number]["key"];

export default function OnboardingPage() {
  const router = useRouter();
  const { ready, authenticated, user: privyUser } = usePrivy();
  const user = useAuthStore((s) => s.user);
  const onboarded = useAuthStore((s) => s.onboarded);
  const hydrated = useAuthStore((s) => s.hydrated);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [agentName, setAgentName] = useState("My Agent");
  const [framework, setFramework] = useState<Framework>("claude-desktop");
  const [address, setAddress] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetKey>("balanced");
  const [customCap, setCustomCap] = useState("250");
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!ready || !hydrated) return;
    if (authenticated && privyUser) {
      applyPrivySession(privyUser);
    }
    const session = useAuthStore.getState();
    if (!session.user && !authenticated) {
      router.replace("/login");
    } else if (session.onboarded) {
      router.replace("/dashboard");
    }
  }, [ready, hydrated, authenticated, privyUser, user, onboarded, router]);

  useEffect(() => {
    if (step === 2 && !address) {
      api
        .generateFundingAddress()
        .then(setAddress)
        .catch(() =>
          toast.error("Couldn't generate a funding address", {
            action: { label: "Retry", onClick: () => setAddress(null) },
          }),
        );
    }
  }, [step, address]);

  if (!ready || !hydrated) return null;
  if (!user || onboarded) return null;

  const capUSD =
    preset === "custom"
      ? Math.max(1, Number.parseFloat(customCap) || 100)
      : POLICY_PRESETS.find((p) => p.key === preset)!.capUSD!;

  const finish = async () => {
    setFinishing(true);
    try {
      await Promise.all([
        api.createAgent({ name: agentName.trim() || "My Agent", framework }),
        api.updatePolicyLimits({ dailyCapUSD: capUSD }),
      ]);
      toast.success("Welcome to Nebula", {
        description: `${agentName.trim() || "My Agent"} is live with a $${capUSD}/day policy.`,
      });
      completeOnboarding();
    } catch {
      toast.error("Setup didn't finish", {
        description: "Nothing was lost — try again.",
        action: { label: "Retry", onClick: () => void finish() },
      });
      setFinishing(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 py-10">
      <div className="mb-10 flex items-center justify-between">
        <Wordmark />
        <span className="text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </span>
      </div>

      <div
        className="mb-10 flex gap-1.5"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={4}
        aria-label="Onboarding progress"
      >
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= step ? "bg-primary" : "bg-elevated",
            )}
          />
        ))}
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex-1"
      >
        {step === 0 ? (
          <section>
            <h1 className="page-title">Name your first agent</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              This is the identity that will hold keys and make payments.
            </p>
            <div className="mt-8 space-y-2">
              <Label htmlFor="agent-name">Agent name</Label>
              <Input
                id="agent-name"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setStep(1);
                }}
                autoFocus
              />
            </div>
          </section>
        ) : step === 1 ? (
          <section>
            <h1 className="page-title">Pick your framework</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Where will this agent run? You can add more later.
            </p>
            <div role="radiogroup" aria-label="Framework" className="mt-8 grid gap-3 sm:grid-cols-2">
              {FRAMEWORKS.map((key) => {
                const meta = FRAMEWORK_META[key];
                const selected = framework === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFramework(key)}
                    className={cn(
                      "card-edge flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors",
                      selected ? "border-primary/60 bg-elevated" : "hover:bg-elevated/60",
                    )}
                  >
                    <meta.icon
                      className={cn("size-5", selected ? "text-primary" : "text-muted-foreground")}
                      aria-hidden
                    />
                    <span className="flex-1 text-sm font-medium">{meta.label}</span>
                    {selected ? <Check className="size-4 text-primary" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : step === 2 ? (
          <section>
            <h1 className="page-title">Fund your wallet</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Send testnet XLM to this address. You can also skip and fund later.
            </p>
            <Card className="mt-8 flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-start">
              <div className="rounded-lg bg-white p-3 shadow-sm" aria-hidden>
                {address ? (
                  <QRCodeSVG
                    value={address}
                    size={132}
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                    level="M"
                  />
                ) : (
                  <Skeleton className="size-[132px]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-muted-foreground">Your agent&apos;s Stellar address</p>
                {address ? (
                  <div className="mt-1.5 flex items-center gap-1">
                    <p className="break-all font-mono text-sm" title={address}>
                      {truncMiddle(address, 8, 8)}
                    </p>
                    <CopyButton value={address} label="Copy address" />
                  </div>
                ) : (
                  <Skeleton className="mt-2 h-5 w-44" />
                )}
                <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                  Testnet funds only. Idle balance starts earning on Blend once auto-yield is on.
                </p>
              </div>
            </Card>
          </section>
        ) : (
          <section>
            <h1 className="page-title">Set your first spending policy</h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Enforced by a Soroban contract on-chain — not by a server.
            </p>
            <div role="radiogroup" aria-label="Spending policy" className="mt-8 grid gap-3 sm:grid-cols-2">
              {POLICY_PRESETS.map((option) => {
                const selected = preset === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPreset(option.key)}
                    className={cn(
                      "card-edge rounded-xl border bg-card p-4 text-left transition-colors",
                      selected ? "border-primary/60 bg-elevated" : "hover:bg-elevated/60",
                    )}
                  >
                    <span className="flex items-center justify-between text-sm font-medium">
                      {option.label}
                      {selected ? <Check className="size-4 text-primary" aria-hidden /> : null}
                    </span>
                    <span className="mt-1 block text-[13px] text-muted-foreground">{option.blurb}</span>
                  </button>
                );
              })}
            </div>
            {preset === "custom" ? (
              <div className="mt-4 max-w-48 space-y-2">
                <Label htmlFor="custom-cap">Daily cap (USD)</Label>
                <Input
                  id="custom-cap"
                  type="number"
                  min={1}
                  value={customCap}
                  onChange={(e) => setCustomCap(e.target.value)}
                />
              </div>
            ) : null}
          </section>
        )}
      </motion.div>

      <div className="mt-10 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || finishing}
        >
          Back
        </Button>
        <div className="flex gap-2">
          {step === 2 ? (
            <Button variant="ghost" onClick={() => setStep(3)}>
              Skip for now
            </Button>
          ) : null}
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)}>
              {step === 2 ? "I've funded it" : "Continue"}
            </Button>
          ) : (
            <Button onClick={() => void finish()} disabled={finishing}>
              {finishing ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Deploying policy…
                </>
              ) : (
                "Finish setup"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
