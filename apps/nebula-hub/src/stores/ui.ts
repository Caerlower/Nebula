import { create } from "zustand";

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

/** Initial UI network before /api/me hydrates preferredNetwork. */
function initialNetwork(): "testnet" | "mainnet" {
  if (typeof process === "undefined") return "testnet";
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
  /** Preferred Stellar network for this account (persisted via /api/me). */
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
