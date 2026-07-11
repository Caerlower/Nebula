"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import * as api from "@/lib/api";
import { useLoad } from "@/lib/use-load";
import { useAuthStore } from "@/stores/auth";

export function DangerSection() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const { data: workspace } = useLoad(() => api.getWorkspace(), []);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const destroy = async () => {
    await api.deleteWorkspace();
    toast.success("Workspace deleted", { description: "Everything is gone. Fresh skies." });
    signOut();
    router.replace("/login");
  };

  return (
    <Card className="border-destructive/40 p-5">
      <p className="text-[13px] font-medium text-destructive">Danger zone</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm">Delete this workspace</p>
          <p className="max-w-md text-[13px] text-muted-foreground">
            Permanently removes agents, keys, policies, and history for{" "}
            <span className="text-foreground">{workspace?.name ?? "this workspace"}</span>. Funds
            remain on-chain at your addresses.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={!workspace}>
          Delete workspace
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete workspace?"
        description="This is permanent. Agents disconnect immediately and API keys stop working."
        confirmLabel="Delete forever"
        destructive
        typeToConfirm={workspace?.name}
        onConfirm={destroy}
      />
    </Card>
  );
}
