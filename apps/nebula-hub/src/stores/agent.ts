import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useUIStore } from "@/stores/ui";

type HubNetwork = "testnet" | "mainnet";

/**
 * Which agent's workspace is currently in focus. Every data page (Dashboard,
 * Treasury, Transactions, Policy, Reputation) scopes to THIS agent's own wallet
 * — never the owner/login (EOA or Privy) wallet, which is auth-only.
 *
 * Selection is keyed by network so testnet and mainnet twins stay isolated
 * when the NetworkChip switches ledgers.
 */
interface AgentScopeState {
  selectedByNetwork: Record<HubNetwork, string | null>;
  /** Active selection for the UI store's current network. */
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  /** Wipe selection for one network (e.g. before a ledger switch reload). */
  clearSelectedForNetwork: (network: HubNetwork) => void;
}

function syncSelected(
  byNetwork: Record<HubNetwork, string | null>,
): string | null {
  const network = useUIStore.getState().network;
  return byNetwork[network] ?? null;
}

export const useAgentStore = create<AgentScopeState>()(
  persist(
    (set, get) => ({
      selectedByNetwork: { testnet: null, mainnet: null },
      selectedAgentId: null,
      setSelectedAgentId: (id) => {
        const network = useUIStore.getState().network;
        const selectedByNetwork = {
          ...get().selectedByNetwork,
          [network]: id,
        };
        set({ selectedByNetwork, selectedAgentId: id });
      },
      clearSelectedForNetwork: (network) => {
        const selectedByNetwork = {
          ...get().selectedByNetwork,
          [network]: null,
        };
        const selectedAgentId = syncSelected(selectedByNetwork);
        set({ selectedByNetwork, selectedAgentId });
      },
    }),
    {
      name: "nebula-selected-agent",
      // Migrate flat `selectedAgentId` persist → per-network map (assume testnet).
      merge: (persisted, current) => {
        const p = persisted as
          | {
              selectedAgentId?: string | null;
              selectedByNetwork?: Record<HubNetwork, string | null>;
            }
          | undefined;
        if (!p) return current;
        const selectedByNetwork = p.selectedByNetwork ?? {
          testnet: p.selectedAgentId ?? null,
          mainnet: null,
        };
        return {
          ...current,
          ...p,
          selectedByNetwork,
          selectedAgentId: syncSelected(selectedByNetwork),
        };
      },
      partialize: (state) => ({
        selectedByNetwork: state.selectedByNetwork,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.selectedAgentId = syncSelected(state.selectedByNetwork);
      },
    },
  ),
);

/** Re-read selection after UI network changes (without waiting for remount). */
export function syncAgentSelectionToNetwork(network: HubNetwork): void {
  const { selectedByNetwork } = useAgentStore.getState();
  useAgentStore.setState({
    selectedAgentId: selectedByNetwork[network] ?? null,
  });
}

/**
 * Non-React accessor so the data-fetch layer can scope requests to the selected
 * agent without threading an id through every call site.
 */
export function getSelectedAgentId(): string | null {
  return useAgentStore.getState().selectedAgentId;
}
