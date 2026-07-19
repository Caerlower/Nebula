import {
  ArrowRightLeft,
  Award,
  Bot,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  PiggyBank,
  Plug,
  Settings,
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
 * destinations — never agent-scoped tools (Treasury / Transactions / …).
 */
export const ACCOUNT_NAV_SECTIONS: NavSection[] = [
  {
    label: "Account",
    items: [
      { label: "Agents", href: "/agents", icon: Bot },
      { label: "Settings", href: "/settings", icon: Settings },
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
 */
export const AGENT_NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Wallet",
    items: [
      { label: "Treasury", href: "/treasury", icon: PiggyBank },
      { label: "Transactions", href: "/transactions", icon: ArrowRightLeft },
      { label: "Policy", href: "/policy", icon: ShieldCheck },
    ],
  },
  {
    label: "Agent",
    items: [
      { label: "Reputation", href: "/reputation", icon: Award },
      { label: "Connect", href: "/connect", icon: Plug },
      { label: "API Keys", href: "/api-keys", icon: KeyRound },
    ],
  },
];

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

/** The nav to show for the current level. */
export function navSectionsFor(pathname: string): NavSection[] {
  return isAgentWorkspaceRoute(pathname)
    ? AGENT_NAV_SECTIONS
    : ACCOUNT_NAV_SECTIONS;
}

export const ALL_NAV_ITEMS: NavItem[] = [
  ...ACCOUNT_NAV_SECTIONS,
  ...AGENT_NAV_SECTIONS,
].flatMap((section) => section.items);

/** Human label for the current page (used in breadcrumbs). */
export function pageLabelFor(pathname: string): string {
  const item = ALL_NAV_ITEMS.find(
    (candidate) =>
      pathname === candidate.href || pathname.startsWith(`${candidate.href}/`),
  );
  return item?.label ?? "Home";
}
