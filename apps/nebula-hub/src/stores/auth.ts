import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SessionUser } from "@/types/domain";

interface AuthState {
  user: SessionUser | null;
  onboarded: boolean;
  /** Wallet-native (Freighter/EOA) session active — auth via httpOnly cookie, not Privy. */
  walletAuthed: boolean;
  /** Connected Stellar address for wallet sessions. */
  walletAddress: string | null;
  /** false until localStorage rehydrate finishes */
  hydrated: boolean;
  signIn: (user: SessionUser) => void;
  signInWallet: (address: string, user: SessionUser) => void;
  completeOnboarding: () => void;
  signOut: () => void;
  setHydrated: (value: boolean) => void;
}

const AUTH_STORAGE_KEY = "nebula-auth";

/** Zustand persist writes via microtask — flush sync before hard navigations. */
export function flushAuthStorage() {
  if (typeof window === "undefined") return;
  try {
    const { user, onboarded, walletAuthed, walletAddress } =
      useAuthStore.getState();
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        state: { user, onboarded, walletAuthed, walletAddress },
        version: 0,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      onboarded: false,
      walletAuthed: false,
      walletAddress: null,
      hydrated: false,
      signIn: (user) => {
        set({ user, onboarded: true });
        flushAuthStorage();
      },
      signInWallet: (address, user) => {
        set({
          user,
          walletAuthed: true,
          walletAddress: address,
          onboarded: true,
        });
        flushAuthStorage();
      },
      completeOnboarding: () => {
        set({ onboarded: true });
        flushAuthStorage();
      },
      signOut: () => {
        set({
          user: null,
          onboarded: false,
          walletAuthed: false,
          walletAddress: null,
        });
        flushAuthStorage();
      },
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        user: state.user,
        onboarded: state.onboarded,
        walletAuthed: state.walletAuthed,
        walletAddress: state.walletAddress,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("[auth] rehydrate failed", error);
        }
        // Always mark hydrated — even when rehydrate fails — otherwise login
        // stays on "Signing you in" forever.
        // Prefer the action on the rehydrated state; fall back to a microtask
        // so we never touch `useAuthStore` while `create()` is still assigning it.
        if (state && typeof state.setHydrated === "function") {
          state.setHydrated(true);
          return;
        }
        queueMicrotask(() => {
          useAuthStore.setState({ hydrated: true });
        });
      },
    },
  ),
);
