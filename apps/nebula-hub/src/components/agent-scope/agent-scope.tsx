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
 * Hook for data pages: returns the currently selected agent, plus loading /
 * empty flags. When there are no agents the caller should render nothing
 * (the AgentScopeGate shows the shared empty state at the shell level).
 */
export function useSelectedAgent(): {
  agent: Agent | null;
  agentId: string | null;
  loading: boolean;
  hasAgents: boolean;
} {
  const { selectedAgent, selectedAgentId, loading, hasAgents } = useAgentScope();
  return { agent: selectedAgent, agentId: selectedAgentId, loading, hasAgents };
}

/**
 * First-run guard: a freshly-signed-in user (EOA or Privy) with zero agents is
 * sent straight to the "create your first agent" flow — never an empty grid, a
 * bare dashboard, or (critically) owner/EOA/Privy wallet data. Account-level
 * settings and the create flow itself stay reachable so they don't loop.
 */
export function AgentScopeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, hasAgents } = useAgentScope();

  const onCreateFlow = pathname === "/agents/new";
  const onAccountSettings = pathname.startsWith("/settings");
  const needsFirstAgent =
    !loading && !hasAgents && !onCreateFlow && !onAccountSettings;

  useEffect(() => {
    if (needsFirstAgent) router.replace("/agents/new");
  }, [needsFirstAgent, router]);

  if (needsFirstAgent) return null;

  return <>{children}</>;
}
