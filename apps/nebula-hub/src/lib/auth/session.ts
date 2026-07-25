"use client";

import { getAccessToken, type User } from "@privy-io/react-auth";

import type { SessionUser } from "@/types/domain";
import { flushAuthStorage, useAuthStore } from "@/stores/auth";

/** Authenticated fetch to Hub APIs using the Privy access token. */
export async function hubFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  // Privy users send a Bearer token; wallet-native (Freighter) users
  // authenticate via the httpOnly session cookie, sent automatically same-origin.
  let token: string | null = null;
  try {
    token = await getAccessToken();
  } catch {
    token = null;
  }
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers });
}

export async function syncHubSession(): Promise<{
  userId: string;
  email: string | null;
  name?: string | null;
  stellarAddress: string | null;
  walletProvisioned: boolean;
}> {
  const res = await hubFetch("/api/me");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { reason?: string };
    throw new Error(body.reason ?? "session_sync_failed");
  }
  return res.json() as Promise<{
    userId: string;
    email: string | null;
    name?: string | null;
    stellarAddress: string | null;
    walletProvisioned: boolean;
  }>;
}

export function sessionUserFromPrivy(privyUser: User): SessionUser {
  const email =
    privyUser.email?.address ||
    privyUser.google?.email ||
    privyUser.github?.email ||
    "you@nebula.dev";
  const name =
    privyUser.google?.name ||
    privyUser.github?.name ||
    displayNameFromEmail(email);
  return { name, email, imageUrl: imageUrlFromPrivy(privyUser) };
}

/** Best-effort profile photo from linked OAuth accounts. */
export function imageUrlFromPrivy(privyUser: User): string | null {
  const google = privyUser.google as
    | { profilePictureUrl?: string | null }
    | undefined;
  if (google?.profilePictureUrl) return google.profilePictureUrl;

  for (const account of privyUser.linkedAccounts) {
    if (account.type === "google_oauth") {
      const pic = account as {
        profilePictureUrl?: string | null;
        profile_picture_url?: string | null;
      };
      if (pic.profilePictureUrl) return pic.profilePictureUrl;
      if (pic.profile_picture_url) return pic.profile_picture_url;
    }
    if (account.type === "github_oauth" && "username" in account) {
      const username = account.username;
      if (typeof username === "string" && username.trim()) {
        return `https://avatars.githubusercontent.com/${username.trim()}`;
      }
    }
  }

  if (privyUser.github?.username) {
    return `https://avatars.githubusercontent.com/${privyUser.github.username}`;
  }
  return null;
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "there";
  const name = local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
  return name || "Nebula User";
}

/**
 * Mirror Privy → Hub zustand store and flush to localStorage.
 * Preserves `onboarded` unless explicitly overridden.
 */
export function applyPrivySession(
  privyUser: User,
  options?: { onboarded?: boolean },
): SessionUser {
  const session = sessionUserFromPrivy(privyUser);
  const prev = useAuthStore.getState();
  // Keep a previously fetched Google photo if Privy's user object omits it.
  if (!session.imageUrl && prev.user?.imageUrl) {
    session.imageUrl = prev.user.imageUrl;
  }
  useAuthStore.setState({
    user: session,
    onboarded: options?.onboarded ?? prev.onboarded,
    pendingEmail: null,
  });
  flushAuthStorage();
  return session;
}
