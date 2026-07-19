"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as api from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import type { TeamMember } from "@/types/domain";

const ROLES: TeamMember["role"][] = ["Admin", "Member"];

export function TeamSection() {
  const { data: members, loading, setData } = useLoad(() => api.getTeam(), []);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMember["role"]>("Member");
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);

  const invite = async () => {
    const email = inviteEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    setInviting(true);
    try {
      const member = await api.inviteMember(email, inviteRole);
      setData([...(members ?? []), member]);
      setInviteEmail("");
      toast.success(`Invited ${email}`);
    } catch {
      toast.error("Couldn't send the invite", {
        action: { label: "Retry", onClick: () => void invite() },
      });
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (member: TeamMember, role: TeamMember["role"]) => {
    const previous = members ?? [];
    setData(previous.map((m) => (m.id === member.id ? { ...m, role } : m)));
    try {
      await api.updateMemberRole(member.id, role);
      toast.success(`${member.name} is now ${role}`);
    } catch {
      setData(previous);
      toast.error("Couldn't change the role");
    }
  };

  const remove = async (member: TeamMember) => {
    const previous = members ?? [];
    setData(previous.filter((m) => m.id !== member.id));
    try {
      await api.removeMember(member.id);
      toast.success(`${member.name} removed`);
    } catch {
      setData(previous);
      toast.error("Couldn't remove the member");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <p className="mb-4 text-[13px] font-medium text-muted-foreground">Invite a teammate</p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void invite();
          }}
        >
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@company.dev"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamMember["role"])}>
              <SelectTrigger id="invite-role" className="w-32" aria-label="Invite role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={inviting}>
            {inviting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Invite
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Members</p>
        </div>
        {loading || !members ? (
          <TableSkeleton rows={3} cols={4} className="p-5" />
        ) : members.length === 0 ? (
          <EmptyState title="No members" subtitle="Invite your team to manage agents together." />
        ) : (
          <ul className="divide-y divide-border">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-elevated text-xs">
                    {member.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  Joined {fmtDate(member.joinedAt)}
                </span>
                {member.role === "Owner" ? (
                  <Badge variant="outline" className="font-normal text-primary">
                    Owner
                  </Badge>
                ) : (
                  <>
                    <Select
                      value={member.role}
                      onValueChange={(role) => void changeRole(member, role as TeamMember["role"])}
                    >
                      <SelectTrigger
                        className="h-8 w-28"
                        aria-label={`Role for ${member.name}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setRemoveTarget(member)}
                      aria-label={`Remove ${member.name}`}
                    >
                      Remove
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={removeTarget != null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name}?`}
        description="They lose access to this workspace immediately."
        confirmLabel="Remove member"
        destructive
        onConfirm={async () => {
          if (removeTarget) await remove(removeTarget);
        }}
      />
    </div>
  );
}
