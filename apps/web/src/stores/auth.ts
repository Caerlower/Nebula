import { create } from "zustand";

import type { SessionUser } from "@/lib/api";

interface AuthState {
  user: SessionUser | null;
  /** email captured during signup, shown on the verify screen */
  pendingEmail: string | null;
  onboarded: boolean;
  setPendingEmail: (email: string) => void;
  /** called after the verify step — signs the user in and routes to onboarding */
  completeVerification: () => void;
  signIn: (user: SessionUser) => void;
  completeOnboarding: () => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  pendingEmail: null,
  onboarded: false,
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
    set({ user: { name: name || "Nebula User", email }, pendingEmail: null, onboarded: false });
  },
  signIn: (user) => set({ user, onboarded: true }),
  completeOnboarding: () => set({ onboarded: true }),
  signOut: () => set({ user: null, pendingEmail: null, onboarded: false }),
}));
