/**
 * Nebula design tokens — the single home for raw hex values in this app.
 * globals.css mirrors these as rgb()/rgba() custom properties; everything
 * else must consume CSS variables (or this module, for JS-side consumers
 * like the syntax-highlighter theme).
 *
 * Mirrors apps/landing/src/lib/theme.ts: "light" is the warm-midnight
 * default, "dark" is the deep violet night variant.
 */

export type ThemeMode = "light" | "dark";

export interface AppThemeTokens {
  bg: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accent2: string;
  accent3: string;
  destructive: string;
}

export const THEMES: Record<ThemeMode, AppThemeTokens> = {
  light: {
    bg: "#0F1220",
    surface: "#171A2B",
    surfaceElevated: "#1F2338",
    border: "rgba(255,255,255,0.08)",
    text: "#F1EEE8",
    textMuted: "#A8A2B8",
    textSubtle: "#7A738C",
    accent: "#F26B7A",
    accent2: "#4FB8A8",
    accent3: "#EBC178",
    destructive: "#E5484D",
  },
  dark: {
    bg: "#0A0912",
    surface: "#12101C",
    surfaceElevated: "#1A1726",
    border: "rgba(255,255,255,0.07)",
    text: "#EEEAF4",
    textMuted: "#9A94AA",
    textSubtle: "#6E687E",
    accent: "#8E6BFF",
    accent2: "#3ECFC1",
    accent3: "#D4A855",
    destructive: "#E5484D",
  },
};

/**
 * Categorical chart palette — deeper steps of the brand hues, validated for
 * lightness band, chroma floor, CVD separation and surface contrast against
 * both theme surfaces. Fixed order; identical in both themes so series keep
 * their identity across a theme toggle.
 */
export const CHART_HEX = {
  chart1: "#DD4A5E",
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
