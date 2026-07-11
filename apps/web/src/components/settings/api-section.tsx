"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Webhook as WebhookIcon } from "lucide-react";

import { ApiKeysCard } from "@/components/shared/api-keys-card";
import { ListSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "@/lib/api";
import { useLoad } from "@/lib/use-load";

export function ApiSection() {
  const { data: webhooks, loading, setData } = useLoad(() => api.getWebhooks(), []);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async () => {
    const trimmed = url.trim();
    if (!/^https:\/\/.+/.test(trimmed)) {
      toast.error("Webhook URLs must be https://");
      return;
    }
    setAdding(true);
    try {
      const webhook = await api.addWebhook(trimmed, ["policy.violation", "tx.failed"]);
      setData([...(webhooks ?? []), webhook]);
      setUrl("");
      toast.success("Webhook added");
    } catch {
      toast.error("Couldn't add the webhook", {
        action: { label: "Retry", onClick: () => void add() },
      });
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    const previous = webhooks ?? [];
    setData(previous.filter((w) => w.id !== id));
    try {
      await api.removeWebhook(id);
      toast.success("Webhook removed");
    } catch {
      setData(previous);
      toast.error("Couldn't remove the webhook");
    }
  };

  return (
    <div className="space-y-6">
      <ApiKeysCard />

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Webhooks</p>
        </div>
        <form
          className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div className="min-w-64 flex-1 space-y-1.5">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://api.yourapp.dev/hooks/nebula"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="font-mono text-[13px]"
            />
          </div>
          <Button type="submit" disabled={adding}>
            {adding ? <Loader2 className="size-4 animate-spin" /> : <WebhookIcon className="size-4" />}
            Add webhook
          </Button>
        </form>
        {loading || !webhooks ? (
          <ListSkeleton rows={2} className="p-5" />
        ) : webhooks.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No webhooks yet — add one to get policy violations and failed transactions pushed to
            your stack.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {webhooks.map((webhook) => (
              <li key={webhook.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{webhook.url}</code>
                <span className="flex gap-1.5">
                  {webhook.events.map((event) => (
                    <Badge key={event} variant="outline" className="font-mono text-[10px] font-normal">
                      {event}
                    </Badge>
                  ))}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => void remove(webhook.id)}
                  aria-label={`Remove webhook ${webhook.url}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
