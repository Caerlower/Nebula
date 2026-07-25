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
  cancelLabel?: string;
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
  cancelLabel = "Cancel",
  destructive = false,
  typeToConfirm,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const blocked = Boolean(typeToConfirm && typed !== typeToConfirm);

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
      <DialogContent className="max-w-[440px] gap-0 overflow-hidden p-0 sm:rounded-[20px]">
        <div className="border-b border-border px-7 pt-7 pb-5">
          <DialogHeader className="gap-3 pr-8">
            <p
              className={cn(
                "font-mono text-[10px] tracking-[0.18em]",
                destructive ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {destructive ? "CONFIRM · IRREVERSIBLE" : "CONFIRM"}
            </p>
            <DialogTitle className="text-[20px] leading-tight tracking-[-0.02em]">
              {title}
            </DialogTitle>
            <DialogDescription className="text-[14px] leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {typeToConfirm ? (
          <div className="space-y-2 border-b border-border px-7 py-5">
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
              className="box-border h-11 w-full rounded-xl border border-border bg-[var(--panel-3)] px-3.5 font-mono text-[13px] outline-none transition-[border-color] focus:border-border-strong"
            />
          </div>
        ) : null}

        <DialogFooter className="gap-3 px-7 py-5 sm:justify-stretch">
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className="h-11 flex-1 rounded-full border border-border bg-[var(--panel-3)] px-5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={blocked || busy}
            onClick={() => void handleConfirm()}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-medium transition-opacity disabled:opacity-50",
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-[var(--btn-bg)] text-[var(--btn-fg)] hover:opacity-90",
            )}
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
