"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { Suspense } from "react";

import { Wordmark } from "@/components/shell/wordmark";
import { applyPrivySession } from "@/lib/hub-session";
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
          <figcaption className="mt-3 text-sm opacity-75">
            {quote.author} <span className="opacity-80">— {quote.role}</span>
          </figcaption>
        </motion.figure>
      </AnimatePresence>
    </div>
  );
}

/** Relative return paths only (OAuth /approve flows). Reject protocol-relative. */
function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function AuthRedirect() {
  const { ready, authenticated, user } = usePrivy();
  const hydrated = useAuthStore((s) => s.hydrated);
  const onboarded = useAuthStore((s) => s.onboarded);
  const walletAuthed = useAuthStore((s) => s.walletAuthed);
  const router = useRouter();
  const searchParams = useSearchParams();

  const oauthReturn =
    searchParams.has("privy_oauth_code") ||
    searchParams.has("privy_oauth_state");

  useEffect(() => {
    if (!hydrated || oauthReturn) return;

    // Preserve OAuth / approve returnTo so MCP consent isn't lost after login.
    const returnTo = safeReturnTo(searchParams.get("returnTo"));
    const home = onboarded ? "/agents" : "/onboarding";

    // Wallet-native (Freighter) session — no Privy involved.
    if (walletAuthed) {
      router.replace(returnTo ?? home);
      return;
    }

    if (!ready || !authenticated || !user) return;
    applyPrivySession(user);
    router.replace(returnTo ?? home);
  }, [
    ready,
    hydrated,
    authenticated,
    user,
    onboarded,
    walletAuthed,
    oauthReturn,
    searchParams,
    router,
  ]);

  return null;
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Suspense fallback={null}>
            <AuthRedirect />
          </Suspense>
          {children}
        </div>
      </div>
      <div className="aurora-panel hidden w-[46%] flex-col justify-between border-l border-border p-12 text-[var(--brand-offwhite)] [--primary:var(--brand-lavender)] min-[900px]:flex">
        <Wordmark className="relative z-10 text-[26px]" />
        <div className="relative z-10 max-w-md">
          <RotatingQuote />
        </div>
        <p className="relative z-10 text-xs opacity-60">
          A Stellar wallet your agent can hold. Policy on-chain, yield on idle.
        </p>
      </div>
    </div>
  );
}
