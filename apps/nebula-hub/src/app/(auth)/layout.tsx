"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";

import { Wordmark } from "@/components/shell/wordmark";
import { applyPrivySession } from "@/lib/auth/session";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";

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
    <div className="relative min-h-[9.5rem]" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.figure
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.45 }}
          className="absolute inset-0"
        >
          <blockquote className="text-[clamp(1.25rem,2.2vw,1.625rem)] font-semibold leading-[1.35] tracking-[-0.015em] text-pretty">
            “{quote.text}”
          </blockquote>
          <figcaption className="mt-4 font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
            {quote.author.toUpperCase()}
            <span className="text-subtle"> · {quote.role.toUpperCase()}</span>
          </figcaption>
        </motion.figure>
      </AnimatePresence>
    </div>
  );
}

function ThemePill() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const label = theme === "day" ? "DARK" : "LIGHT";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex shrink-0 items-center rounded-full border border-border px-[13px] py-2 font-mono text-[10px] tracking-[0.12em] text-muted-foreground hover:text-foreground"
      aria-label={`Switch to ${label.toLowerCase()} theme`}
    >
      {label}
    </button>
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

    const returnTo = safeReturnTo(searchParams.get("returnTo"));
    const home = onboarded ? "/agents" : "/onboarding";

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
    <div className="flex min-h-dvh bg-background">
      <div className="relative flex flex-1 flex-col px-6 py-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col">
          <div className="flex items-center justify-between">
            <Wordmark />
            <ThemePill />
          </div>

          <div className="flex flex-1 flex-col justify-center py-10">
            <Suspense fallback={null}>
              <AuthRedirect />
            </Suspense>
            {children}
          </div>

          <p className="font-mono text-[10px] tracking-[0.12em] text-subtle">
            STELLAR · POLICY · YIELD
          </p>
        </div>
      </div>

      <aside className="relative hidden w-[min(48%,560px)] flex-col justify-between overflow-hidden border-l border-border bg-elevated p-10 lg:flex xl:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_70%_15%,var(--ambient-a),transparent_70%)]"
        />
        <div
          aria-hidden
          className="texture-dots pointer-events-none absolute inset-0 opacity-40"
        />

        <div className="relative z-10">
          <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
            NEBULA HUB
          </span>
        </div>

        <div className="relative z-10 max-w-md">
          <RotatingQuote />
        </div>

        <p className="relative z-10 max-w-sm font-mono text-[11px] leading-relaxed tracking-[0.04em] text-muted-foreground">
          A Stellar wallet your agent can hold. Policy on-chain, yield on idle.
        </p>
      </aside>
    </div>
  );
}
