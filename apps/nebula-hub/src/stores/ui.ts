import { create } from "zustand";

import { networkFromHostname } from "@/lib/network";
import type { ThemeMode } from "@/lib/theme";

/**
 * The root layout's pre-paint script already resolved the theme (shared
 * nebula_theme cookie, else system preference) onto <html data-theme> before
 * this module evaluates — adopt it so store and DOM agree from the start.
 */
function initialTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  const current = document.documentElement.dataset.theme;
  if (current === "dark" || current === "light" || current === "day") return current;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Initial UI network: Host subdomain, else NEXT_PUBLIC_HUB_NETWORK / STELLAR_NETWORK. */
function initialNetwork(): "testnet" | "mainnet" {
  if (typeof window !== "undefined") {
    const fromHost = networkFromHostname(window.location.hostname);
    if (fromHost) return fromHost;
  }
  if (typeof process === "undefined") return "testnet";
  if (process.env.NEXT_PUBLIC_HUB_NETWORK === "mainnet") return "mainnet";
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "mainnet"
    : "testnet";
}

interface UIState {
  /** "light" | "dark" = night variants; "day" = paper light. Toggle is day ↔ dark. */
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  /** Stellar network for this Host (testnet.* / mainnet.*). */
  network: "testnet" | "mainnet";
  setNetwork: (network: "testnet" | "mainnet") => void;
  /** cross-page quick actions (command palette → target page) */
  createAgentOpen: boolean;
  setCreateAgentOpen: (open: boolean) => void;
  depositOpen: boolean;
  setDepositOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  theme: initialTheme(),
  setTheme: (theme) => set({ theme }),
  // One click: paper (day) ↔ black (dark). Matches ThemePill LIGHT·DARK.
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "day" ? "dark" : "day" })),
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
  network: initialNetwork(),
  setNetwork: (network) => set({ network }),
  createAgentOpen: false,
  setCreateAgentOpen: (open) => set({ createAgentOpen: open }),
  depositOpen: false,
  setDepositOpen: (open) => set({ depositOpen: open }),
}));
