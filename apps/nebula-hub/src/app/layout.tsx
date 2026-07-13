import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";

import { Providers } from "@/app/providers";

import "./globals.css";

const sans = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: { default: "Nebula", template: "%s · Nebula" },
  description:
    "Manage your AI agent's Stellar wallet — automated yield, x402/MPP payments, on-chain spending policy, and Stellar8004 reputation.",
};

/**
 * Runs before paint: adopt the theme shared with the landing page via the
 * nebula_theme cookie (falling back to the system preference), so navigating
 * between landing and app never flashes or flips themes.
 */
const themeInitScript = `try{var m=document.cookie.match(/(?:^|; )nebula_theme=(dark|light|day)/);var t=m?m[1]:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${sans.variable} ${display.variable} ${mono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
