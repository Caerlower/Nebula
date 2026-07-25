"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

import {
  SettingsPanel,
  SettingsRow,
} from "@/components/settings/settings-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { imageUrlFromPrivy } from "@/lib/auth/session";
import * as api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { truncMiddle } from "@/lib/utils";

export function AccountSection() {
  const user = useAuthStore((s) => s.user);
  const walletAuthed = useAuthStore((s) => s.walletAuthed);
  const walletAddress = useAuthStore((s) => s.walletAddress);
  const signIn = useAuthStore((s) => s.signIn);
  const network = useUIStore((s) => s.network);
  const { user: privyUser } = usePrivy();
  const [name, setName] = useState(user?.name ?? "");
  const [editing, setEditing] = useState(false);
  const [savingName, setSavingName] = useState(false);

  if (!user) return null;

  const photoUrl =
    user.imageUrl || (privyUser ? imageUrlFromPrivy(privyUser) : null) || undefined;
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const saveName = async () => {
    if (!name.trim() || name.trim() === user.name) {
      setEditing(false);
      return;
    }
    setSavingName(true);
    try {
      const updated = await api.updateAccount({ name: name.trim() });
      signIn({ ...user, name: updated.name });
      toast.success("Name updated");
      setEditing(false);
    } catch {
      toast.error("Couldn't update your name");
    } finally {
      setSavingName(false);
    }
  };

  return (
    <SettingsPanel
      id="account"
      title="ACCOUNT"
      cta={editing ? undefined : "Edit account"}
      onCta={() => setEditing(true)}
    >
      <div className="mt-4 mb-2 flex items-center gap-3">
        <Avatar className="size-10">
          {photoUrl ? (
            <AvatarImage src={photoUrl} alt="" referrerPolicy="no-referrer" />
          ) : null}
          <AvatarFallback className="bg-[var(--panel-3)] text-sm">{initials}</AvatarFallback>
        </Avatar>
        <p className="text-[12px] text-muted-foreground">
          Sign-in is managed by Privy for this account.
        </p>
      </div>
      <SettingsRow label="Email" value={user.email || "—"} />
      <SettingsRow
        label="Name"
        value={
          editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 w-44 font-mono text-[12px]"
                aria-label="Display name"
              />
              <button
                type="button"
                disabled={savingName}
                onClick={() => void saveName()}
                className="font-mono text-[10px] tracking-[0.1em] text-primary"
              >
                {savingName ? <Loader2 className="size-3.5 animate-spin" /> : "SAVE"}
              </button>
            </div>
          ) : (
            user.name
          )
        }
      />
      <SettingsRow
        label="Account wallet"
        value={
          walletAuthed && walletAddress
            ? truncMiddle(walletAddress, 6, 4)
            : "—"
        }
      />
      <SettingsRow
        label="Network"
        value={network === "mainnet" ? "STELLAR MAINNET" : "STELLAR TESTNET"}
      />
    </SettingsPanel>
  );
}
