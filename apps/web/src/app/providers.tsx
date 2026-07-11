"use client";

import { useEffect } from "react";

import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/components/shell/command-palette";
import { useUIStore } from "@/stores/ui";

/** Theme is shared with the landing page: nebula_theme cookie + live channel. */
const THEME_CHANNEL = "nebula_theme";

function readThemeCookie(): "light" | "dark" | null {
  const match = document.cookie.match(/(?:^|; )nebula_theme=(dark|light)/);
  return match ? (match[1] as "light" | "dark") : null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.cookie = `nebula_theme=${theme}; path=/; max-age=31536000; samesite=lax`;
    if (typeof BroadcastChannel !== "undefined") {
      // Receivers ignore values equal to their current theme, so the echo
      // that follows an incoming sync terminates immediately.
      const channel = new BroadcastChannel(THEME_CHANNEL);
      channel.postMessage(theme);
      channel.close();
    }
  }, [theme]);

  useEffect(() => {
    const applyExternal = (next: string | null) => {
      if (next !== "light" && next !== "dark") return;
      if (next !== useUIStore.getState().theme) useUIStore.getState().setTheme(next);
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(THEME_CHANNEL);
      channel.onmessage = (event: MessageEvent) => applyExternal(event.data as string);
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

  return (
    <>
      {children}
      <CommandPalette />
      <Toaster position="bottom-right" />
    </>
  );
}
