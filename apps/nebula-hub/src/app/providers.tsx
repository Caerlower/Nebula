"use client";

import dynamic from "next/dynamic";
import { PrivyProvider } from "@privy-io/react-auth";
import { useEffect } from "react";

import { Toaster } from "@/components/ui/sonner";
import { PrivyAvatarSync } from "@/components/shared/privy-avatar-sync";
import { THEMES } from "@/lib/theme";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";

const CommandPalette = dynamic(
  () =>
    import("@/components/shell/command-palette").then((m) => m.CommandPalette),
  { ssr: false },
);

/** Theme is shared with the landing page: nebula_theme cookie + live channel. */
const THEME_CHANNEL = "nebula_theme";

function readThemeCookie(): "light" | "dark" | "day" | null {
  const match = document.cookie.match(/(?:^|; )nebula_theme=(dark|light|day)/);
  return match ? (match[1] as "light" | "dark" | "day") : null;
}

function ThemeSync({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.cookie = `nebula_theme=${theme}; path=/; max-age=31536000; samesite=lax`;
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(THEME_CHANNEL);
      channel.postMessage(theme);
      channel.close();
    }
  }, [theme]);

  useEffect(() => {
    const applyExternal = (next: string | null) => {
      if (next !== "light" && next !== "dark" && next !== "day") return;
      if (next !== useUIStore.getState().theme) useUIStore.getState().setTheme(next);
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(THEME_CHANNEL);
      channel.onmessage = (event: MessageEvent) =>
        applyExternal(event.data as string);
    }
    const syncFromCookie = () => applyExternal(readThemeCookie());
    window.addEventListener("pageshow", syncFromCookie);
    document.addEventListener("visibilitychange", syncFromCookie);
    return () => {
      channel?.close();
      window.removeEventListener("pageshow", syncFromCookie);
      document.removeEventListener("visibilitychange", syncFromCookie);
    };
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Safety net: never leave the UI wedged on hydrated=false.
  useEffect(() => {
    const { persist } = useAuthStore;
    const unsub = persist.onFinishHydration(() => {
      useAuthStore.setState({ hydrated: true });
    });
    if (persist.hasHydrated()) {
      useAuthStore.setState({ hydrated: true });
    }
    const t = window.setTimeout(() => {
      if (!useAuthStore.getState().hydrated) {
        useAuthStore.setState({ hydrated: true });
      }
    }, 1500);
    return () => {
      unsub();
      window.clearTimeout(t);
    };
  }, []);

  const inner = (
    <ThemeSync>
      {children}
      <CommandPalette />
      <Toaster position="bottom-right" />
    </ThemeSync>
  );

  if (!appId) {
    console.error(
      "[privy] NEXT_PUBLIC_PRIVY_APP_ID is missing — login will not work",
    );
    return inner;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google", "github"],
        appearance: {
          // Match the site's warm-midnight tokens so any Privy-rendered
          // surface doesn't read as a different product.
          theme: THEMES.light.surface as `#${string}`,
          accentColor: THEMES.light.accent as `#${string}`,
          logo: "/favicon.svg",
        },
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
      }}
    >
      <PrivyAvatarSync />
      {inner}
    </PrivyProvider>
  );
}
