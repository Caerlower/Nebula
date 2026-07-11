"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { Wordmark } from "@/components/shell/wordmark";
import { useAuthStore } from "@/stores/auth";

const QUOTES = [
  {
    text: "My agent pays for its own API calls now. I checked the policy contract twice because I didn't believe it.",
    author: "Riley Chen",
    role: "builds trading agents",
  },
  {
    text: "Set the daily cap, walked away for a week, came back to yield. That's the whole pitch and it's true.",
    author: "Tomás Ferreira",
    role: "indie MCP developer",
  },
  {
    text: "The first time a 402 resolved itself mid-conversation I actually laughed out loud.",
    author: "Priya Natarajan",
    role: "agent infra at a fintech",
  },
];

function RotatingQuote() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % QUOTES.length), 6500);
    return () => clearInterval(timer);
  }, []);

  const quote = QUOTES[index]!;

  return (
    <div className="relative h-36" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.figure
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <blockquote className="font-display text-xl leading-relaxed">
            “{quote.text}”
          </blockquote>
          <figcaption className="mt-3 text-sm text-muted-foreground">
            {quote.author} <span className="text-subtle">— {quote.role}</span>
          </figcaption>
        </motion.figure>
      </AnimatePresence>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const onboarded = useAuthStore((s) => s.onboarded);
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace(onboarded ? "/dashboard" : "/onboarding");
  }, [user, onboarded, router]);

  return (
    <div className="flex min-h-dvh">
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
      <div className="aurora-panel hidden w-[46%] flex-col justify-between border-l border-border p-12 min-[900px]:flex">
        <Wordmark className="text-[26px]" />
        <div className="relative z-10 max-w-md">
          <RotatingQuote />
        </div>
        <p className="relative z-10 text-xs text-subtle">
          A Stellar wallet your agent can hold. Policy on-chain, yield on idle.
        </p>
      </div>
    </div>
  );
}
