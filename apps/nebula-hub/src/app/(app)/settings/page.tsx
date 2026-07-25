"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Braces,
  CreditCard,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SectionRule } from "@/components/design/primitives";
import { AccountSection } from "@/components/settings/account-section";
import { ApiSection } from "@/components/settings/api-section";
import { BillingSection } from "@/components/settings/billing-section";
import { DangerSection } from "@/components/settings/danger-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { TeamSection } from "@/components/settings/team-section";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";

const SECTIONS: {
  key: string;
  label: string;
  icon: LucideIcon;
  component: React.ComponentType;
}[] = [
  { key: "account", label: "Account", icon: UserRound, component: AccountSection },
  { key: "team", label: "Team", icon: Users, component: TeamSection },
  { key: "billing", label: "Billing", icon: CreditCard, component: BillingSection },
  {
    key: "notifications",
    label: "Notifications",
    icon: Bell,
    component: NotificationsSection,
  },
  { key: "api", label: "API", icon: Braces, component: ApiSection },
  {
    key: "danger",
    label: "Danger zone",
    icon: TriangleAlert,
    component: DangerSection,
  },
];

function sectionFromHash(): string {
  if (typeof window === "undefined") return "account";
  const hash = window.location.hash.replace(/^#/, "");
  return SECTIONS.some((s) => s.key === hash) ? hash : "account";
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [active, setActive] = useState("account");

  useEffect(() => {
    setActive(sectionFromHash());
    const onHash = () => setActive(sectionFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const select = useCallback((key: string) => {
    setActive(key);
    window.history.replaceState(null, "", `/settings#${key}`);
  }, []);

  const section = SECTIONS.find((s) => s.key === active) ?? SECTIONS[0]!;
  const Section = section.component;

  return (
    <div>
      <div className="pb-6">
        <SectionRule>ACCOUNT SETTINGS</SectionRule>
        <h1 className="page-title">{user?.name || "Account"}</h1>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <nav
          aria-label="Settings sections"
          className="soft-panel shrink-0 p-2 md:w-56"
        >
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {SECTIONS.map((item) => {
              const isActive = item.key === section.key;
              const isDanger = item.key === "danger";
              return (
                <li key={item.key}>
                  {isDanger ? (
                    <div className="my-2 hidden h-px bg-border md:block" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => select(item.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-left font-mono text-[11px] tracking-[0.08em] uppercase transition-colors",
                      isActive
                        ? isDanger
                          ? "bg-[var(--accent-soft)] text-destructive"
                          : "bg-[var(--accent-soft)] text-foreground"
                        : isDanger
                          ? "text-destructive/80 hover:bg-elevated/60 hover:text-destructive"
                          : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4 shrink-0",
                        isActive && !isDanger && "text-primary",
                      )}
                      aria-hidden
                    />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <Section />
        </div>
      </div>
    </div>
  );
}
