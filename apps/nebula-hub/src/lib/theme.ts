/**
 * Nebula design tokens — Claude Design Hub system (2026).
 * globals.css mirrors these as rgb()/rgba() custom properties.
 *
 * Default (data-theme="light"): near-black panels + violet accent.
 * Dark: deeper black variant.
 * Day: warm paper light mode (mock [data-theme=light]).
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
    bg: "#0B0B0D",
    surface: "#121216",
    surfaceElevated: "#16161A",
    border: "#202027",
    text: "#F6F7F8",
    textMuted: "#94949E",
    textSubtle: "#5C5C65",
    accent: "#8B5CF6",
    accentGradientEnd: "#B7ACE8",
    accent2: "#8FBF9F",
    accent3: "#D6D2C4",
    destructive: "#E05A47",
  },
  dark: {
    bg: "#08080A",
    surface: "#0E0E12",
    surfaceElevated: "#141418",
    border: "#1A1A22",
    text: "#F6F7F8",
    textMuted: "#8A8A94",
    textSubtle: "#52525A",
    accent: "#8B5CF6",
    accentGradientEnd: "#B7ACE8",
    accent2: "#8FBF9F",
    accent3: "#D6D2C4",
    destructive: "#E05A47",
  },
  day: {
    bg: "#EFEFEC",
    surface: "#FBFBF9",
    surfaceElevated: "#FFFFFF",
    border: "#E4E3DC",
    text: "#111112",
    textMuted: "#66665F",
    textSubtle: "#9A9A92",
    accent: "#6D28D9",
    accentGradientEnd: "#5C4EA8",
    accent2: "#3F7A55",
    accent3: "#A9A392",
    destructive: "#B23D2A",
  },
};

export const CHART_HEX = {
  dark: {
    chart1: "#6F88A3",
    chart2: "#8FBF9F",
    chart3: "#8B5CF6",
    chart4: "#D6D2C4",
    chart5: "#5C5C65",
  },
  day: {
    chart1: "#4A6B8C",
    chart2: "#3F7A55",
    chart3: "#6D28D9",
    chart4: "#A9A392",
    chart5: "#9A9A92",
  },
} as const;

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;
