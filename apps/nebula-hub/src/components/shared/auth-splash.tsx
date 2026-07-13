"use client";

import { Wordmark } from "@/components/shell/wordmark";

interface AuthSplashProps {
  title?: string;
  detail?: string;
}

/**
 * Branded interstitial for auth transitions (signing in, session checks).
 * Same tokens and type as the rest of the site — no bare spinners.
 */
export function AuthSplash({ title = "Signing you in", detail }: AuthSplashProps) {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <Wordmark className="text-[22px] opacity-80" />
      <span className="relative mt-10 inline-block size-11" aria-hidden>
        <span className="absolute inset-0 rounded-full border-2 border-elevated" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
      </span>
      <h1 className="mt-8 font-display text-[28px] leading-tight">{title}</h1>
      {detail ? (
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}
