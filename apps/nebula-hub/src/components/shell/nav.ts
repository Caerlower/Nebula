import {
  ArrowRightLeft,
  Award,
  Bot,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  PiggyBank,
  Plug,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** External link — opens in a new tab instead of client-side routing. */
  external?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/* ============================ LEVEL 1: ACCOUNT ============================ */
/**
 * Account home. No agent is selected here, so it only shows account-wide
 * destinations — never agent-scoped tools (Treasury / Activity / …).
 */
export const ACCOUNT_NAV_SECTIONS: NavSection[] = [
  {
    label: "Account",
    items: [
      { label: "Fleet", href: "/agents", icon: Bot },
    ],
  },
];

/** Bottom-of-sidebar utilities at the account level. */
export const ACCOUNT_UTILITIES: NavItem[] = [
  { label: "MCP docs", href: "https://docs.nebulaonchain.xyz", icon: Plug, external: true },
  { label: "Help & Discord", href: "https://discord.gg/nebula", icon: LifeBuoy, external: true },
];

/* ========================= LEVEL 2: AGENT WORKSPACE ======================= */
/**
 * Everything here is scoped to the currently selected agent's own wallet.
 * Labels match Claude Design (hrefs unchanged for AgentScopeGate / deep links).
 */
export const AGENT_NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "Treasury", href: "/treasury", icon: PiggyBank },
      { label: "Activity", href: "/transactions", icon: ArrowRightLeft },
      { label: "Policy", href: "/policy", icon: ShieldCheck },
      { label: "Reputation", href: "/reputation", icon: Award },
      { label: "Connect", href: "/connect", icon: Plug },
      { label: "API Keys", href: "/api-keys", icon: KeyRound },
      { label: "Fleet", href: "/agents", icon: Bot },
    ],
  },
];

/** Flat tab lists for the sticky header (Claude Design). */
export function tabsFor(pathname: string): NavItem[] {
  // Settings is account content, not a separate chrome level — keep workspace tabs.
  if (
    isAgentWorkspaceRoute(pathname) ||
    pathname.startsWith("/agents") ||
    pathname.startsWith("/settings")
  ) {
    return AGENT_NAV_SECTIONS.flatMap((s) => s.items);
  }
  return ACCOUNT_NAV_SECTIONS.flatMap((s) => s.items);
}

/** Routes that live INSIDE an agent workspace (Level 2). */
const AGENT_WORKSPACE_ROUTES = [
  "/dashboard",
  "/treasury",
  "/transactions",
  "/policy",
  "/reputation",
  "/connect",
  "/api-keys",
];

export function isAgentWorkspaceRoute(pathname: string): boolean {
  return AGENT_WORKSPACE_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
}

export const ALL_NAV_ITEMS: NavItem[] = [
  ...ACCOUNT_NAV_SECTIONS,
  ...AGENT_NAV_SECTIONS,
].flatMap((section) => section.items);
