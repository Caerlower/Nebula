import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Github, Twitter, BookOpen } from "lucide-react";
import { ParticleNebula } from "@/components/nebula/ParticleNebula";
import { CursorTrail } from "@/components/nebula/CursorTrail";
import { MagneticButton } from "@/components/nebula/MagneticButton";
import { LetterReveal } from "@/components/nebula/LetterReveal";
import { TiltCard } from "@/components/nebula/TiltCard";
import { StrokeIcon, drawVariants } from "@/components/nebula/StrokeIcon";
import { WaitlistModal } from "@/components/nebula/WaitlistModal";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const hueFilter = useTransform(scrollYProgress, [0, 1], ["hue-rotate(0deg)", "hue-rotate(60deg)"]);
  const parallaxY = useTransform(scrollYProgress, [0, 1], ["0%", "-15%"]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <CursorTrail />

      {/* Global nebula glow washes */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ filter: hueFilter }}
      >
        <div className="absolute inset-0">
          <div
            className="absolute -top-40 left-1/4 h-[60rem] w-[60rem] rounded-full opacity-40 blur-[140px]"
            style={{
              background:
                "radial-gradient(closest-side, var(--color-nebula-purple), transparent 70%)",
            }}
          />
          <div
            className="absolute top-1/3 -right-40 h-[50rem] w-[50rem] rounded-full opacity-30 blur-[140px]"
            style={{
              background:
                "radial-gradient(closest-side, var(--color-nebula-blue), transparent 70%)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 h-[45rem] w-[45rem] rounded-full opacity-25 blur-[140px]"
            style={{
              background:
                "radial-gradient(closest-side, var(--color-nebula-teal), transparent 70%)",
            }}
          />
        </div>
      </motion.div>

      {/* Top nav */}
      <header className="relative z-20 flex items-center justify-between px-6 py-6 sm:px-10">
        <a href="#" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, white, var(--color-nebula-purple) 70%)",
              boxShadow: "0 0 12px var(--color-nebula-purple)",
            }}
          />
          Nebula
        </a>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/10"
        >
          Join waitlist
        </button>
      </header>

      {/* HERO */}
      <section className="relative flex min-h-[calc(100vh-80px)] items-center justify-center px-6">
        <motion.div style={{ y: parallaxY }} className="absolute inset-0">
          <ParticleNebula intensity={1} />
        </motion.div>
        {/* vignette */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, var(--color-background) 95%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-nebula-teal shadow-[0_0_8px_var(--color-nebula-teal)]" />
            Now in private beta
          </motion.div>
          <LetterReveal
            as="h1"
            text="Give your AI agent a wallet."
            delay={0.3}
            className="text-balance bg-gradient-to-b from-white to-white/60 bg-clip-text text-5xl font-semibold tracking-[-0.03em] text-transparent sm:text-7xl lg:text-8xl"
          />
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
            className="mx-auto mt-8 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl"
          >
            Nebula is an MCP server that gives any AI agent a Stellar wallet it can
            actually spend from, with x402 payments and native DeFi built in.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.9 }}
            className="mt-12 flex items-center justify-center gap-4"
          >
            <MagneticButton onClick={() => setOpen(true)}>
              Join the waitlist
              <ArrowRight className="h-4 w-4" />
            </MagneticButton>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 1 }}
            className="mt-16 text-xs uppercase tracking-[0.3em] text-muted-foreground/60"
          >
            Built on Stellar · MCP native · x402 ready
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative z-10 px-6 py-32 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
            className="mb-20 max-w-3xl"
          >
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-nebula-teal">
              How it works
            </p>
            <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
              Three steps to an agent that can pay.
            </h2>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            <TiltCard index={0}>
              <StrokeIcon>
                <motion.path variants={drawVariants} d="M8 24h14" />
                <motion.path variants={drawVariants} d="M28 18v12a4 4 0 0 0 4 4h6" />
                <motion.circle variants={drawVariants} cx="24" cy="24" r="4" />
              </StrokeIcon>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">Plug in</h3>
              <p className="mt-3 text-muted-foreground">
                Connect Nebula to Claude, GPT, or any MCP-compatible framework in
                seconds. One line of config.
              </p>
            </TiltCard>
            <TiltCard index={1}>
              <StrokeIcon>
                <motion.path variants={drawVariants} d="M8 32h32" />
                <motion.path variants={drawVariants} d="M14 32V20" />
                <motion.path variants={drawVariants} d="M24 32V12" />
                <motion.path variants={drawVariants} d="M34 32V24" />
              </StrokeIcon>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">Set limits</h3>
              <p className="mt-3 text-muted-foreground">
                Define a daily cap, allowlisted counterparties, and spend rules your
                agent can never exceed.
              </p>
            </TiltCard>
            <TiltCard index={2}>
              <StrokeIcon>
                <motion.path variants={drawVariants} d="M10 24l6 6 22-22" />
                <motion.circle variants={drawVariants} cx="24" cy="34" r="10" />
              </StrokeIcon>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">Let it run</h3>
              <p className="mt-3 text-muted-foreground">
                Your agent pays for APIs, sends USDC, and uses DeFi on its own —
                autonomously, transparently.
              </p>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 px-6 py-32 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9 }}
            className="mb-20 max-w-3xl"
          >
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-nebula-teal">
              Built for autonomous economies
            </p>
            <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
              Everything an agent needs to transact.
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                title: "x402 autonomous payments",
                body: "Agents settle micro-payments in-line with HTTP, no human in the loop. Pay-per-request, pay-per-token.",
              },
              {
                title: "Native Stellar DeFi",
                body: "First-class access to Blend for lending and Soroswap for swaps — as callable tools your agent understands.",
              },
              {
                title: "Spending controls & audit",
                body: "Hard-capped budgets, allowlists, and a full signed audit trail of every transaction the agent made and why.",
              },
              {
                title: "Works with any MCP agent",
                body: "Drop into Claude, Cursor, or your own framework. If it speaks MCP, it speaks Nebula.",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div
                  aria-hidden
                  className="absolute -top-32 -right-24 h-64 w-64 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-60"
                  style={{
                    background:
                      "radial-gradient(closest-side, var(--color-nebula-purple), transparent 70%)",
                  }}
                />
                <h3 className="relative text-2xl font-semibold tracking-tight">
                  {f.title}
                </h3>
                <p className="relative mt-3 text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 flex min-h-[80vh] items-center justify-center overflow-hidden px-6 py-32">
        <div className="absolute inset-0 opacity-90">
          <ParticleNebula intensity={1.15} />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 30%, var(--color-background) 90%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
            className="text-balance bg-gradient-to-b from-white to-white/60 bg-clip-text text-5xl font-semibold tracking-[-0.03em] text-transparent sm:text-7xl"
          >
            The agent economy runs on Stellar.
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.3, duration: 0.9 }}
            className="mt-12 flex justify-center"
          >
            <MagneticButton onClick={() => setOpen(true)}>
              Join the waitlist
              <ArrowRight className="h-4 w-4" />
            </MagneticButton>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-10 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 text-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, white, var(--color-nebula-purple) 70%)",
                boxShadow: "0 0 10px var(--color-nebula-purple)",
              }}
            />
            <span className="font-semibold tracking-tight">Nebula</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="inline-flex items-center gap-1.5 transition hover:text-foreground">
              <BookOpen className="h-4 w-4" /> Docs
            </a>
            <a href="#" className="inline-flex items-center gap-1.5 transition hover:text-foreground">
              <Twitter className="h-4 w-4" /> Twitter
            </a>
            <a href="#" className="inline-flex items-center gap-1.5 transition hover:text-foreground">
              <Github className="h-4 w-4" /> GitHub
            </a>
          </div>
          <div className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Nebula. Built on Stellar.
          </div>
        </div>
      </footer>

      <WaitlistModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
