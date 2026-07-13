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
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready || !hydrated) return;

    // Privy is the source of truth — never bounce to /login while Privy says
    // the user is signed in (that was the OAuth ↔ dashboard loop).
    if (!authenticated || !privyUser) {
      router.replace("/login");
      return;
    }

    applyPrivySession(privyUser);

    if (!useAuthStore.getState().onboarded) {
      router.replace("/onboarding");
    }
  }, [ready, hydrated, authenticated, privyUser, router, pathname]);

  if (!ready || !hydrated) return <GateSkeleton />;
  if (!authenticated || !privyUser) return <GateSkeleton />;
  if (!onboarded) return <GateSkeleton />;

  return <AppShell>{children}</AppShell>;
}
