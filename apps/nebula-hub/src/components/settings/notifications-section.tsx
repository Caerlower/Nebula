"use client";

import { toast } from "sonner";

import { ListSkeleton } from "@/components/shared/skeletons";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import * as api from "@/lib/api";
import { useLoad } from "@/hooks/use-load";
import type { NotificationPrefs } from "@/types/domain";

const PREFS: { key: keyof NotificationPrefs; label: string; blurb: string }[] = [
  {
    key: "policyViolations",
    label: "Policy violations",
    blurb: "An agent tried to spend outside its on-chain limits.",
  },
  {
    key: "lowBalance",
    label: "Low balance",
    blurb: "Liquid balance drops below your liquidity floor.",
  },
  {
    key: "yieldMilestones",
    label: "Yield milestones",
    blurb: "Lifetime yield crosses a round number worth celebrating.",
  },
  {
    key: "weeklySummary",
    label: "Weekly summary",
    blurb: "One email each Monday: spend, yield, reputation delta.",
  },
];

export function NotificationsSection() {
  const { data: prefs, loading, setData } = useLoad(() => api.getNotificationPrefs(), []);

  const toggle = async (key: keyof NotificationPrefs, next: boolean) => {
    if (!prefs) return;
    const previous = prefs;
    setData({ ...prefs, [key]: next });
    try {
      await api.updateNotificationPrefs({ [key]: next });
    } catch {
      setData(previous);
      toast.error("Couldn't save that preference", {
        action: { label: "Retry", onClick: () => void toggle(key, next) },
      });
    }
  };

  return (
    <Card className="p-5">
      <p className="mb-4 text-[13px] font-medium text-muted-foreground">Email notifications</p>
      {loading || !prefs ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {PREFS.map((pref) => (
            <div key={pref.key} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm">{pref.label}</p>
                <p className="text-[13px] text-muted-foreground">{pref.blurb}</p>
              </div>
              <Switch
                checked={prefs[pref.key]}
                onCheckedChange={(next) => void toggle(pref.key, next)}
                aria-label={pref.label}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
