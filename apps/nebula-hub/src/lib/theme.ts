/**
 * Nebula design tokens — the single home for raw hex values in this app.
 * globals.css mirrors these as rgb()/rgba() custom properties; everything
 * else must consume CSS variables (or this module, for JS-side consumers
 * like the syntax-highlighter theme).
 *
 * Mirrors apps/landing/src/lib/theme.ts: "light" is the warm-midnight
 * default, "dark" is the deep violet night variant.
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
    bg: "#0F1220",
    surface: "#191C2F",
    surfaceElevated: "#22263E",
    border: "rgba(255,255,255,0.08)",
    text: "#F1EEE8",
    textMuted: "#A8A2B8",
    textSubtle: "#7A738C",
    accent: "#F26B7A",
    accentGradientEnd: "#EB9878",
    accent2: "#55C4B3",
    accent3: "#EEC57C",
    destructive: "#E5484D",
  },
  dark: {
    bg: "#0A0912",
    surface: "#141222",
    surfaceElevated: "#1E1B30",
    border: "rgba(255,255,255,0.07)",
    text: "#EEEAF4",
    textMuted: "#9A94AA",
    textSubtle: "#6E687E",
    accent: "#7C6BF0",
    accentGradientEnd: "#5B8DEF",
    accent2: "#2DD4BF",
    accent3: "#F5B248",
    destructive: "#E5484D",
  },
  day: {
    bg: "#F4F1FA",
    surface: "#FFFFFF",
    surfaceElevated: "#EEEAF8",
    border: "rgba(26,21,46,0.12)",
    text: "#1A152E",
    textMuted: "#4A4466",
    textSubtle: "#7A738E",
    accent: "#6D28D9",
    accentGradientEnd: "#3B82F6",
    accent2: "#0F766E",
    accent3: "#C2410C",
    destructive: "#DC2626",
  },
};

/**
 * Categorical chart palette — deeper steps of the brand hues, validated for
 * lightness band, chroma floor, CVD separation and surface contrast against
 * both theme surfaces. Fixed order; identical in both themes so series keep
 * their identity across a theme toggle.
 */
export const CHART_HEX = {
  chart1: "#E0506A",
  chart2: "#0F9C88",
  chart3: "#BE8827",
  chart4: "#6B82EC",
  chart5: "#8B84A3",
} as const;

/** CSS-variable form — prefer these inside components. */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;
