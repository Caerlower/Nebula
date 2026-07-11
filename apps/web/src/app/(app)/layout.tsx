"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { useAuthStore } from "@/stores/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const onboarded = useAuthStore((s) => s.onboarded);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    } else if (!onboarded) {
      router.replace("/onboarding");
    }
  }, [user, onboarded, router, pathname]);

  if (!user || !onboarded) return null;

  return <AppShell>{children}</AppShell>;
}
