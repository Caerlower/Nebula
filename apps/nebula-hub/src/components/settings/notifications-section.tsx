"use client";

import { SettingsPanel } from "@/components/settings/settings-panel";

export function NotificationsSection() {
  return (
    <SettingsPanel id="notifications" title="NOTIFICATIONS">
      <p className="py-2 text-[13px] text-muted-foreground">
        Email and in-app alerts are not wired yet. Spend caps, allow/deny lists,
        and pause still enforce in the Hub.
      </p>
    </SettingsPanel>
  );
}
