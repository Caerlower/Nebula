"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { imageUrlFromPrivy } from "@/lib/hub-session";
import * as api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export function AccountSection() {
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const { user: privyUser } = usePrivy();
  const [name, setName] = useState(user?.name ?? "");
  const [savingName, setSavingName] = useState(false);

  if (!user) return null;

  const photoUrl =
    user.imageUrl || (privyUser ? imageUrlFromPrivy(privyUser) : null) || undefined;

  const saveName = async () => {
    if (!name.trim() || name.trim() === user.name) return;
    setSavingName(true);
    try {
      await api.updateAccount({ name: name.trim() });
      signIn({ ...user, name: name.trim() });
      toast.success("Name updated");
    } catch {
      toast.error("Couldn't update your name");
    } finally {
      setSavingName(false);
    }
  };

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-6">
      <Card className="space-y-5 p-5">
        <p className="text-[13px] font-medium text-muted-foreground">Profile</p>
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            {photoUrl ? <AvatarImage src={photoUrl} alt="" referrerPolicy="no-referrer" /> : null}
            <AvatarFallback className="bg-elevated text-lg">{initials}</AvatarFallback>
          </Avatar>
          <p className="text-[13px] text-muted-foreground">
            Sign-in and security are managed by Privy for this account.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="acct-email">Email</Label>
            <Input id="acct-email" value={user.email} disabled aria-label="Email (read-only)" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acct-name">Name</Label>
            <div className="flex gap-2">
              <Input id="acct-name" value={name} onChange={(e) => setName(e.target.value)} />
              {name.trim() !== user.name ? (
                <Button onClick={() => void saveName()} disabled={savingName}>
                  {savingName ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
