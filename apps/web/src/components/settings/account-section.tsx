"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import * as api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export function AccountSection() {
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const [name, setName] = useState(user?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  if (!user) return null;

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

  const changePassword = async () => {
    if (newPw.length < 8) {
      toast.error("New password needs at least 8 characters");
      return;
    }
    setSavingPw(true);
    try {
      await api.changePassword(currentPw, newPw);
      setCurrentPw("");
      setNewPw("");
      toast.success("Password changed");
    } catch {
      toast.error("Couldn't change the password");
    } finally {
      setSavingPw(false);
    }
  };

  const toggle2fa = async (next: boolean) => {
    setTwoFactor(next);
    try {
      await api.updateAccount({ twoFactor: next });
      toast.success(next ? "Two-factor enabled" : "Two-factor disabled");
    } catch {
      setTwoFactor(!next);
      toast.error("Couldn't update two-factor auth");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-5 p-5">
        <p className="text-[13px] font-medium text-muted-foreground">Profile</p>
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-elevated text-lg">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <label className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Upload avatar
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Upload avatar"
                onChange={() => toast.success("Avatar updated", { description: "Looking sharp." })}
              />
            </label>
            <p className="text-xs text-subtle">PNG or JPG, up to 2 MB.</p>
          </div>
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

      <Card className="space-y-4 p-5">
        <p className="text-[13px] font-medium text-muted-foreground">Password</p>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void changePassword();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">New password</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={savingPw || !currentPw || !newPw}>
              {savingPw ? <Loader2 className="size-4 animate-spin" /> : null}
              Change password
            </Button>
          </div>
        </form>
      </Card>

      <Card className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm">Two-factor authentication</p>
          <p className="text-[13px] text-muted-foreground">
            Require a one-time code alongside your password.
          </p>
        </div>
        <Switch
          checked={twoFactor}
          onCheckedChange={(next) => void toggle2fa(next)}
          aria-label="Two-factor authentication"
        />
      </Card>
    </div>
  );
}
