"use client";

import {
  SettingsPanel,
  SettingsRow,
} from "@/components/settings/settings-panel";
import * as api from "@/lib/api";
import { useLoad } from "@/hooks/use-load";

export function BillingSection() {
  const { data: agents } = useLoad(() => api.getAgents(), []);

  return (
    <SettingsPanel id="billing" title="BILLING">
      <SettingsRow label="Plan" value="FREE" />
      <SettingsRow label="Agents" value={String(agents?.length ?? 0)} />
      <p className="mt-3 max-w-md text-[12px] text-muted-foreground">
        Paid plans, invoices, and usage metering are not available yet.
      </p>
    </SettingsPanel>
  );
}
