import {
  ArrowRightLeft,
  Award,
  Bot,
  LayoutDashboard,
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
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
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
    label: "Agents",
    items: [
      { label: "Agents", href: "/agents", icon: Bot },
      { label: "Reputation", href: "/reputation", icon: Award },
    ],
  },
  {
    label: "Setup",
    items: [
      { label: "Connect", href: "/connect", icon: Plug },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

/** "Home / Section / Page" pieces for the topbar breadcrumbs. */
export function breadcrumbsFor(pathname: string): { section: string | null; page: string; detail: string | null } {
  const item = ALL_NAV_ITEMS.find(
    (candidate) => pathname === candidate.href || pathname.startsWith(`${candidate.href}/`),
  );
  if (!item) return { section: null, page: "Home", detail: null };
  const section = NAV_SECTIONS.find((s) => s.items.includes(item))!;
  const rest = pathname.slice(item.href.length).split("/").filter(Boolean);
  let detail: string | null = null;
  const restFirst = rest[0];
  if (restFirst) {
    detail = item.href === "/agents" ? "Agent" : restFirst[0]!.toUpperCase() + restFirst.slice(1);
  }
  return { section: section.label, page: item.label, detail };
}
