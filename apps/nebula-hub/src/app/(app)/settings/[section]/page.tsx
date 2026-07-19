"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  Bell,
  Braces,
  CreditCard,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { AccountSection } from "@/components/settings/account-section";
import { ApiSection } from "@/components/settings/api-section";
import { BillingSection } from "@/components/settings/billing-section";
import { DangerSection } from "@/components/settings/danger-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { TeamSection } from "@/components/settings/team-section";
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

export default function SettingsSectionPage() {
  const params = useParams<{ section: string }>();
  const router = useRouter();
  const section = SECTIONS.find((s) => s.key === params.section);

  useEffect(() => {
    if (!section) router.replace("/settings/account");
  }, [section, router]);

  if (!section) return null;

  const Section = section.component;

  return (
    <div>
      <PageHeader
        eyebrow="setup"
        title="Settings"
        subtitle="Your account, your team, and the big red buttons."
      />
      <div className="flex flex-col gap-8 md:flex-row">
        <nav
          aria-label="Settings sections"
          className="md:w-56 md:shrink-0 md:self-start"
        >
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {SECTIONS.map((item) => {
              const active = item.key === section.key;
              const isDanger = item.key === "danger";
              return (
                <li key={item.key}>
                  {isDanger ? (
                    <div className="my-2 hidden h-px bg-border md:block" />
                  ) : null}
                  <Link
                    href={`/settings/${item.key}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "font-medium text-foreground"
                        : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                      isDanger &&
                        !active &&
                        "text-destructive/80 hover:text-destructive",
                      isDanger && active && "text-destructive",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="settings-nav-pill"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className={cn(
                          "absolute inset-0 rounded-lg border border-border-strong bg-elevated",
                          isDanger
                            ? "shadow-[inset_2px_0_0_var(--destructive)]"
                            : "shadow-[inset_2px_0_0_var(--primary)]",
                        )}
                        aria-hidden
                      />
                    ) : null}
                    <item.icon
                      className={cn(
                        "relative size-4 shrink-0",
                        active && !isDanger && "text-primary",
                      )}
                      aria-hidden
                    />
                    <span className="relative">{item.label}</span>
                  </Link>
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
