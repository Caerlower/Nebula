"use client";

import Link from "next/link";

import {
  SettingsPanel,
  SettingsRow,
} from "@/components/settings/settings-panel";
import * as api from "@/lib/api";
import { useLoad } from "@/hooks/use-load";

export function ApiSection() {
  const { data: keys } = useLoad(() => api.getApiKeys(), []);
  const activeCount = keys?.length ?? 0;

  return (
    <SettingsPanel id="api" title="API">
      <SettingsRow label="Active tokens" value={String(activeCount)} />
      <SettingsRow label="Rate limit" value="120 REQ/MIN" />
      <p className="mt-3 max-w-md text-[12px] text-muted-foreground">
        Webhooks are not available yet. Manage MCP and API keys on the keys page.
      </p>
      <Link
        href="/api-keys"
        className="mt-[18px] inline-flex rounded-full border border-border px-[18px] py-2 text-[12px] text-muted-foreground hover:text-foreground"
      >
        Open API keys
      </Link>
    </SettingsPanel>
  );
}
