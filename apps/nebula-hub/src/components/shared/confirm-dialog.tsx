"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** when set, the user must type this exact string to enable confirm */
  typeToConfirm?: string;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  typeToConfirm,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const blocked = typeToConfirm ? typed !== typeToConfirm : false;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setTyped("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          onOpenChange(next);
          if (!next) setTyped("");
        }
      }}
    >
      <DialogContent className="max-w-[420px] gap-6">
        <DialogHeader>
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
            CONFIRM
          </p>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {typeToConfirm ? (
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-input"
              className="block font-mono text-[10px] tracking-[0.12em] text-muted-foreground"
            >
              TYPE{" "}
              <span className="text-foreground">{typeToConfirm}</span> TO
              CONTINUE
            </label>
            <input
              id="confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              aria-label={`Type ${typeToConfirm} to confirm`}
              className="box-border h-10 w-full rounded-xl border border-border bg-[var(--panel-3)] px-3.5 font-mono text-[13px] outline-none transition-[border-color] focus:border-border-strong"
            />
          </div>
        ) : null}

        <DialogFooter>
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-border-strong px-5 py-2.5 text-[13px] text-muted-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={blocked || busy}
            onClick={() => void handleConfirm()}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium disabled:opacity-50",
              destructive
                ? "border border-destructive text-destructive"
                : undefined,
            )}
            style={
              destructive
                ? undefined
                : {
                    background: "var(--btn-bg)",
                    color: "var(--btn-fg)",
                  }
            }
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            {busy ? "Working…" : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
