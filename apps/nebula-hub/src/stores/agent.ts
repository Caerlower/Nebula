import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Which agent's workspace is currently in focus. Every data page (Dashboard,
 * Treasury, Transactions, Policy, Reputation) scopes to THIS agent's own wallet
 * — never the owner/login (EOA or Privy) wallet, which is auth-only.
 */
interface AgentScopeState {
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
}

export const useAgentStore = create<AgentScopeState>()(
  persist(
    (set) => ({
      selectedAgentId: null,
      setSelectedAgentId: (id) => set({ selectedAgentId: id }),
    }),
    { name: "nebula-selected-agent" },
  ),
);

/**
 * Non-React accessor so the data-fetch layer can scope requests to the selected
 * agent without threading an id through every call site.
 */
export function getSelectedAgentId(): string | null {
  return useAgentStore.getState().selectedAgentId;
}
