"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { AccountSection } from "@/components/settings/account-section";
import { ApiSection } from "@/components/settings/api-section";
import { BillingSection } from "@/components/settings/billing-section";
import { DangerSection } from "@/components/settings/danger-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { TeamSection } from "@/components/settings/team-section";
import { cn } from "@/lib/utils";

const SECTIONS: { key: string; label: string; component: React.ComponentType }[] = [
  { key: "account", label: "Account", component: AccountSection },
  { key: "team", label: "Team", component: TeamSection },
  { key: "billing", label: "Billing", component: BillingSection },
  { key: "notifications", label: "Notifications", component: NotificationsSection },
  { key: "api", label: "API", component: ApiSection },
  { key: "danger", label: "Danger zone", component: DangerSection },
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
        subtitle="Account, team, billing, and the sharp knives."
      />
      <div className="flex flex-col gap-8 md:flex-row">
        <nav aria-label="Settings sections" className="md:w-50 md:shrink-0">
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {SECTIONS.map((item) => (
              <li key={item.key}>
                <Link
                  href={`/settings/${item.key}`}
                  aria-current={item.key === section.key ? "page" : undefined}
                  className={cn(
                    "block whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                    item.key === section.key
                      ? "bg-elevated text-foreground"
                      : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                    item.key === "danger" && "text-destructive/80 hover:text-destructive",
                    item.key === "danger" && item.key === section.key && "text-destructive",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">
          <Section />
        </div>
      </div>
    </div>
  );
}
