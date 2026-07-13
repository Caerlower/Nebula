"use client";

import { useEffect } from "react";
import { useOAuthTokens, usePrivy } from "@privy-io/react-auth";

import { imageUrlFromPrivy } from "@/lib/hub-session";
import { flushAuthStorage, useAuthStore } from "@/stores/auth";

function setUserImageUrl(imageUrl: string) {
  const { user } = useAuthStore.getState();
  if (!user || user.imageUrl === imageUrl) return;
  useAuthStore.setState({ user: { ...user, imageUrl } });
  flushAuthStorage();
}

/**
 * Captures OAuth profile photos (Google via userinfo; GitHub via known avatar URL)
 * into the Hub session so Settings / sidebar can render them.
 */
export function PrivyAvatarSync() {
  const { ready, authenticated, user: privyUser } = usePrivy();

  useOAuthTokens({
    onOAuthTokenGrant: ({ oAuthTokens }) => {
      if (oAuthTokens.provider !== "google") return;
      void (async () => {
        try {
          const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${oAuthTokens.accessToken}` },
          });
          if (!res.ok) return;
          const data = (await res.json()) as { picture?: string };
          if (typeof data.picture === "string" && data.picture) {
            setUserImageUrl(data.picture);
          }
        } catch {
          /* initials fallback is fine */
        }
      })();
    },
  });

  useEffect(() => {
    if (!ready || !authenticated || !privyUser) return;
    const url = imageUrlFromPrivy(privyUser);
    if (url) setUserImageUrl(url);
  }, [ready, authenticated, privyUser]);

  return null;
}
