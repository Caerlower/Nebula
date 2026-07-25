"use client";

import { SettingsPanel, SettingsRow } from "@/components/settings/settings-panel";
import * as api from "@/lib/api";
import { useLoad } from "@/hooks/use-load";
import { useNebulaSignOut } from "@/hooks/use-nebula-sign-out";

export function DangerSection() {
  const signOut = useNebulaSignOut();
  const { data: workspace } = useLoad(() => api.getWorkspace(), []);

  return (
    <SettingsPanel id="danger" title="DANGER ZONE" className="border-destructive/35">
      <SettingsRow label="Workspace" value={workspace?.name ?? "…"} />
      <p className="mt-3 max-w-md text-[12px] text-muted-foreground">
        Workspace deletion is not available yet. Signing out clears this device
        session; agents, keys, and on-chain funds are unchanged.
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-[18px] inline-flex rounded-full border border-destructive/40 px-[18px] py-2 text-[12px] text-destructive hover:bg-destructive/5"
      >
        Sign out
      </button>
    </SettingsPanel>
  );
}
