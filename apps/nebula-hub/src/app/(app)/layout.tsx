"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

import { AppShell } from "@/components/shell/app-shell";
import { AuthSplash } from "@/components/shared/auth-splash";
import { applyPrivySession } from "@/lib/hub-session";
import { useAuthStore } from "@/stores/auth";

function GateSkeleton() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <AuthSplash title="Preparing your dashboard" detail="Checking your session…" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user: privyUser } = usePrivy();
  const onboarded = useAuthStore((s) => s.onboarded);
  const hydrated = useAuthStore((s) => s.hydrated);
  const walletAuthed = useAuthStore((s) => s.walletAuthed);
  const router = useRouter();
  const pathname = usePathname();

  // Two ways to be signed in: Privy (custodial) or a wallet session (Freighter).
  const privyAuthed = authenticated && !!privyUser;
  const authed = privyAuthed || walletAuthed;

  useEffect(() => {
    if (!ready || !hydrated) return;

    if (!authed) {
      router.replace("/login");
      return;
    }

    // Only Privy sessions mirror the Privy user; wallet sessions are set at sign-in.
    if (privyAuthed) {
      applyPrivySession(privyUser);
    }

    if (!useAuthStore.getState().onboarded) {
      router.replace("/onboarding");
    }
  }, [ready, hydrated, authed, privyAuthed, privyUser, router, pathname]);

  if (!ready || !hydrated) return <GateSkeleton />;
  if (!authed) return <GateSkeleton />;
  if (!onboarded) return <GateSkeleton />;

  return <AppShell>{children}</AppShell>;
}
