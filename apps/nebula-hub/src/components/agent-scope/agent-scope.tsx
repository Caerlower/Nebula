"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { useLoad } from "@/hooks/use-load";
import * as api from "@/lib/api";
import { useAgentStore } from "@/stores/agent";
import { useUIStore } from "@/stores/ui";
import type { Agent } from "@/types/domain";

interface AgentScopeValue {
  agents: Agent[];
  loading: boolean;
  hasAgents: boolean;
  selectedAgentId: string | null;
  selectedAgent: Agent | null;
  setSelectedAgentId: (id: string | null) => void;
  reloadAgents: () => void;
}

const AgentScopeContext = createContext<AgentScopeValue | null>(null);

export function AgentScopeProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, reload } = useLoad(() => api.getAgents(), []);
  const agents = useMemo(() => data ?? [], [data]);

  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const setSelectedAgentId = useAgentStore((s) => s.setSelectedAgentId);

  // Keep the selection valid: auto-select the first agent when nothing is
  // selected or the previously selected agent no longer exists.
  useEffect(() => {
    if (loading) return;
    if (agents.length === 0) {
      if (selectedAgentId !== null) setSelectedAgentId(null);
      return;
    }
    const stillValid = agents.some((a) => a.id === selectedAgentId);
    if (!stillValid) setSelectedAgentId(agents[0]!.id);
  }, [loading, agents, selectedAgentId, setSelectedAgentId]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  const value = useMemo<AgentScopeValue>(
    () => ({
      agents,
      loading,
      hasAgents: agents.length > 0,
      selectedAgentId,
      selectedAgent,
      setSelectedAgentId,
      reloadAgents: reload,
    }),
    [agents, loading, selectedAgentId, selectedAgent, setSelectedAgentId, reload],
  );

  return (
    <AgentScopeContext.Provider value={value}>
      {children}
    </AgentScopeContext.Provider>
  );
}

export function useAgentScope(): AgentScopeValue {
  const ctx = useContext(AgentScopeContext);
  if (!ctx) {
    throw new Error("useAgentScope must be used within an AgentScopeProvider");
  }
  return ctx;
}

/**
 * First-run guard: a freshly-signed-in user (EOA or Privy) with zero agents is
 * sent to Fleet with the create drawer open — never an empty grid on Overview
 * or (critically) owner/EOA/Privy wallet data. Account settings stay reachable.
 */
export function AgentScopeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, hasAgents } = useAgentScope();
  const setCreateAgentOpen = useUIStore((s) => s.setCreateAgentOpen);

  const onFleet = pathname === "/agents" || pathname.startsWith("/agents/");
  const onAccountSettings = pathname.startsWith("/settings");
  const needsFirstAgent = !loading && !hasAgents && !onAccountSettings;

  useEffect(() => {
    if (!needsFirstAgent) return;
    if (!onFleet) {
      router.replace("/agents");
      setCreateAgentOpen(true);
    }
  }, [needsFirstAgent, onFleet, router, setCreateAgentOpen]);

  if (needsFirstAgent && !onFleet) return null;

  return <>{children}</>;
}
