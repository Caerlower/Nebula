import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Github,
  Layers,
  Plug,
  Shield,
  Sparkles,
  TrendingUp,
  Twitter,
  Wallet,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";

import { FadeIn } from "@/components/nebula/FadeIn";
import { GlassCard } from "@/components/nebula/GlassCard";
import { HeroOrbitalCard } from "@/components/nebula/HeroOrbitalCard";
import { MagneticButton } from "@/components/nebula/MagneticButton";
import { NebulaBackground } from "@/components/nebula/NebulaBackground";
import { StrokeIcon, drawVariants } from "@/components/nebula/StrokeIcon";
import { WaitlistModal } from "@/components/nebula/WaitlistModal";

export const Route = createFileRoute("/")({
  component: Index,
});

const FEATURES = [
  {
    icon: Shield,
    title: "On-chain spending policy",
    body: "Limits enforced by a Soroban contract, not a server.",
  },
  {
    icon: TrendingUp,
    title: "Automated treasury",
    body: "Idle funds auto-earn yield on Blend, with liquidity always protected.",
  },
  {
    icon: Zap,
    title: "x402 payments",
    body: "Agents pay for services autonomously, per request.",
  },
  {
    icon: Layers,
    title: "MPP sessions",
    body: "High-frequency streaming micropayments in one settlement.",
  },
  {
    icon: Sparkles,
    title: "On-chain reputation",
    body: "Verifiable agent identity via Stellar8004.",
  },
  {
    icon: Plug,
    title: "Works everywhere",
    body: "Any MCP-compatible agent, in under a minute.",
  },
] as const;

function Index() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0A0A14] text-white">
      <NebulaBackground />

      {/* Nav */}
      <header className="relative z-20 flex items-center justify-between px-6 py-6 sm:px-10">
        <a href="#" className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              background: "radial-gradient(circle at 30% 30%, white, #7C6BF0 70%)",
              boxShadow: "0 0 12px #7C6BF0",
            }}
          />
          Nebula
        </a>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur transition hover:scale-[1.02] hover:border-white/20 hover:bg-white/10"
        >
          Join waitlist
        </button>
      </header>

      {/* HERO */}
      <section className="relative flex min-h-screen items-center justify-center px-6 pb-20 pt-10">
        <HeroOrbitalCard />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
            className="text-balance bg-gradient-to-b from-white to-white/65 bg-clip-text text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-transparent sm:text-6xl lg:text-7xl"
          >
            Give your AI agent powers on Stellar.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.8, ease: [0.22, 0.61, 0.36, 1] }}
            className="mx-auto mt-7 max-w-2xl text-balance text-base leading-relaxed text-white/55 sm:text-lg"
          >
            Nebula is an MCP that gives any AI agent a Stellar wallet — with automated
            yield, x402 &amp; MPP payments, and on-chain reputation. Set your limits.
            Let it work.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-10 flex justify-center"
          >
            <MagneticButton onClick={() => setOpen(true)}>
              Join the waitlist
              <ArrowRight className="h-4 w-4" />
            </MagneticButton>
          </motion.div>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="relative z-10 px-6 py-24 sm:px-10 sm:py-32">
        <FadeIn className="mx-auto max-w-3xl text-center">
          <p className="text-balance text-xl font-medium leading-relaxed tracking-[-0.01em] text-white/80 sm:text-2xl lg:text-[1.65rem] lg:leading-snug">
            AI agents can think, plan, and reason. But the moment they need to act
            — to pay, to transact — they stop.{" "}
            <span className="text-white">Nebula changes that.</span>
          </p>
        </FadeIn>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative z-10 px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-14 text-center sm:mb-16">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-[#2DD4BF]">
              How it works
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Three steps. Full autonomy.
            </h2>
          </FadeIn>

          <div className="grid gap-6 md:grid-cols-3">
            <GlassCard index={0}>
              <StrokeIcon>
                <motion.path variants={drawVariants} d="M8 24h14" />
                <motion.path variants={drawVariants} d="M28 18v12a4 4 0 0 0 4 4h6" />
                <motion.circle variants={drawVariants} cx="24" cy="24" r="4" />
              </StrokeIcon>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">Plug in</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                Connect Nebula to Claude, GPT, or any agent framework in seconds.
              </p>
            </GlassCard>
            <GlassCard index={1}>
              <StrokeIcon>
                <motion.path variants={drawVariants} d="M8 32h32" />
                <motion.path variants={drawVariants} d="M14 32V20" />
                <motion.path variants={drawVariants} d="M24 32V12" />
                <motion.path variants={drawVariants} d="M34 32V24" />
              </StrokeIcon>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">Set your policy</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                Spending limits enforced on-chain. The agent can never exceed them.
              </p>
            </GlassCard>
            <GlassCard index={2}>
              <StrokeIcon>
                <motion.path variants={drawVariants} d="M10 24l6 6 22-22" />
                <motion.circle variants={drawVariants} cx="24" cy="34" r="10" />
              </StrokeIcon>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">Let it work</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                Your agent pays, earns yield on idle funds, and builds reputation
                autonomously.
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-14 text-center sm:mb-16">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-[#2DD4BF]">
              Features
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Everything an agent needs to transact.
            </h2>
          </FadeIn>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {FEATURES.map((feature, i) => (
              <GlassCard key={feature.title} index={i} className="h-full">
                <feature.icon
                  className="h-5 w-5 text-[#7C6BF0]"
                  strokeWidth={1.5}
                />
                <h3 className="mt-4 text-base font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  {feature.body}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 flex min-h-[70vh] items-center justify-center px-6 py-28">
        <FadeIn className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="text-balance bg-gradient-to-b from-white to-white/60 bg-clip-text text-4xl font-semibold tracking-[-0.03em] text-transparent sm:text-5xl lg:text-6xl">
            The agent economy runs on Stellar.
          </h2>
          <div className="mt-10 flex justify-center">
            <MagneticButton onClick={() => setOpen(true)}>
              Join the waitlist
              <ArrowRight className="h-4 w-4" />
            </MagneticButton>
          </div>
        </FadeIn>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-10 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-sm text-white/45 sm:flex-row">
          <div className="flex items-center gap-2 text-white">
            <Wallet className="h-4 w-4 text-[#7C6BF0]" strokeWidth={1.5} />
            <span className="font-semibold tracking-tight">Nebula</span>
          </div>
          <nav className="flex items-center gap-6">
            <a
              href="#"
              className="inline-flex items-center gap-1.5 transition hover:text-white"
            >
              <BookOpen className="h-4 w-4" /> Docs
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-1.5 transition hover:text-white"
            >
              <Twitter className="h-4 w-4" /> Twitter
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-1.5 transition hover:text-white"
            >
              <Github className="h-4 w-4" /> GitHub
            </a>
          </nav>
        </div>
      </footer>

      <WaitlistModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
