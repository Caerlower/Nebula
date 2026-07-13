import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SessionUser } from "@/lib/api";

interface AuthState {
  user: SessionUser | null;
  pendingEmail: string | null;
  onboarded: boolean;
  /** false until localStorage rehydrate finishes */
  hydrated: boolean;
  setPendingEmail: (email: string) => void;
  completeVerification: () => void;
  signIn: (user: SessionUser) => void;
  completeOnboarding: () => void;
  signOut: () => void;
  setHydrated: (value: boolean) => void;
}

const AUTH_STORAGE_KEY = "nebula-auth";

/** Zustand persist writes via microtask — flush sync before hard navigations. */
export function flushAuthStorage() {
  if (typeof window === "undefined") return;
  try {
    const { user, onboarded, pendingEmail } = useAuthStore.getState();
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        state: { user, onboarded, pendingEmail },
        version: 0,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      pendingEmail: null,
      onboarded: false,
      hydrated: false,
      setPendingEmail: (email) => set({ pendingEmail: email }),
      completeVerification: () => {
        const email = get().pendingEmail ?? "you@nebula.dev";
        const local = email.split("@")[0] ?? "there";
        const name = local
          .replace(/[._-]+/g, " ")
          .split(" ")
          .filter(Boolean)
          .map((part) => part[0]!.toUpperCase() + part.slice(1))
          .join(" ");
        set({
          user: { name: name || "Nebula User", email },
          pendingEmail: null,
          onboarded: false,
        });
        flushAuthStorage();
      },
      signIn: (user) => {
        set({ user, onboarded: true });
        flushAuthStorage();
      },
      completeOnboarding: () => {
        set({ onboarded: true });
        flushAuthStorage();
      },
      signOut: () => {
        set({ user: null, pendingEmail: null, onboarded: false });
        flushAuthStorage();
      },
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        user: state.user,
        onboarded: state.onboarded,
        pendingEmail: state.pendingEmail,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error("[auth] rehydrate failed", error);
        }
        // Always mark hydrated — even when `_state` is undefined on error,
        // otherwise login stays on "Signing you in" forever.
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);
