"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

import { useAuthStore } from "@/stores/auth";

/** Clear Hub session + Privy session, then go to /login. */
export function useNebulaSignOut() {
  const router = useRouter();
  const clearHub = useAuthStore((s) => s.signOut);
  const { logout, ready } = usePrivy();

  return useCallback(async () => {
    clearHub();
    try {
      sessionStorage.removeItem("nebula_login_intent");
    } catch {
      /* ignore */
    }
    try {
      if (ready) {
        await logout();
      }
    } catch (error) {
      console.error("[auth] Privy logout failed", error);
    }
    router.replace("/login");
  }, [clearHub, logout, ready, router]);
}
