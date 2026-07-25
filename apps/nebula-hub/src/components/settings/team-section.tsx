"use client";

import {
  SettingsPanel,
  SettingsRow,
} from "@/components/settings/settings-panel";
import * as api from "@/lib/api";
import { useLoad } from "@/hooks/use-load";

export function TeamSection() {
  const { data: members, loading } = useLoad(() => api.getTeam(), []);

  return (
    <SettingsPanel id="team" title="TEAM">
      {loading || !members ? (
        <p className="py-6 font-mono text-[12px] text-subtle">Loading…</p>
      ) : members.length === 0 ? (
        <p className="py-6 text-[13px] text-muted-foreground">No teammates yet.</p>
      ) : (
        members.map((member) => (
          <SettingsRow
            key={member.id}
            label={member.name}
            value={member.role.toUpperCase()}
          />
        ))
      )}
      <p className="mt-3 max-w-md text-[12px] text-muted-foreground">
        Team invites and roles are not available yet. This account is a single-owner
        workspace.
      </p>
    </SettingsPanel>
  );
}
