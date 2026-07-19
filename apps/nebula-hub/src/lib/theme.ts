/**
 * Nebula design tokens — the single home for raw hex values in this app.
 * globals.css mirrors these as rgb()/rgba() custom properties; everything
 * else must consume CSS variables (or this module, for JS-side consumers
 * like the syntax-highlighter theme).
 *
 * Stellar 2026 brand system. Palette (no colors outside it):
 *   deep navy #002E5D · lavender #B7ACE8 · teal #00A7B5
 *   black #0F0F0F · off-white #F6F7F8 · sand #D6D2C4
 *   + vivid brand purple #6D28D9 (Manav's pick) as the brand-block /
 *     day-theme primary.
 * Surface/text steps are mixes of those primaries. "light" is the
 * purple-cast true-black default, "dark" is the deepest-black variant,
 * "day" is the off-white light mode.
 */

export type ThemeMode = "light" | "dark" | "day";

export interface AppThemeTokens {
  bg: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentGradientEnd: string;
  accent2: string;
  accent3: string;
  destructive: string;
}

export const THEMES: Record<ThemeMode, AppThemeTokens> = {
  light: {
    bg: "#0F0F0F",
    surface: "#16141E",
    surfaceElevated: "#1E1B29",
    border: "rgba(246,247,248,0.12)",
    text: "#F6F7F8",
    textMuted: "#C0C0CB",
    textSubtle: "#9695A2",
    accent: "#B7ACE8",
    accentGradientEnd: "#B7ACE8",
    accent2: "#34B7C3",
    accent3: "#D6D2C4",
    destructive: "#E05C60",
  },
  dark: {
    bg: "#0A0A0A",
    surface: "#131217",
    surfaceElevated: "#1A1920",
    border: "rgba(246,247,248,0.12)",
    text: "#F6F7F8",
    textMuted: "#BCBCC7",
    textSubtle: "#92919E",
    accent: "#B7ACE8",
    accentGradientEnd: "#B7ACE8",
    accent2: "#34B7C3",
    accent3: "#D6D2C4",
    destructive: "#E05C60",
  },
  day: {
    bg: "#F6F7F8",
    surface: "#FFFFFF",
    surfaceElevated: "#EEEBF8",
    border: "#CEC7EB",
    text: "#0F0F0F",
    textMuted: "#383D46",
    textSubtle: "#646972",
    accent: "#6D28D9",
    accentGradientEnd: "#6D28D9",
    accent2: "#007A85",
    accent3: "#736E5C",
    destructive: "#B23434",
  },
};

/**
 * Chart palette — brand hues only, stepped per surface (the light mode
 * needs darker steps for contrast on off-white; dark modes use the raw
 * brand tints). Only chart-2 (balance / teal) and chart-3 (yield /
 * lavender·navy) currently render; the rest are palette-derived spares.
 * The shipping 2↔3 pair passes CVD separation, normal-vision ΔE, and
 * surface contrast on both surfaces.
 */
export const CHART_HEX = {
  dark: {
    chart1: "#6F88A3",
    chart2: "#00A7B5",
    chart3: "#B7ACE8",
    chart4: "#D6D2C4",
    chart5: "#7B7B7C",
  },
  day: {
    chart1: "#4A6B8C",
    chart2: "#00939F",
    chart3: "#6D28D9",
    chart4: "#75736B",
    chart5: "#838384",
  },
} as const;

/** CSS-variable form — prefer these inside components. */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;
