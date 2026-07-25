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

interface UIState {
  /** "light" | "dark" = night variants; "day" = paper light. Toggle is day ↔ dark. */
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
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
  // One click: paper (day) ↔ black (dark). Matches old UI / ThemePill LIGHT·DARK.
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "day" ? "dark" : "day" })),
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
  network: "testnet",
  setNetwork: (network) => set({ network }),
  createAgentOpen: false,
  setCreateAgentOpen: (open) => set({ createAgentOpen: open }),
  depositOpen: false,
  setDepositOpen: (open) => set({ depositOpen: open }),
}));
