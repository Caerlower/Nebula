"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

const RESEND_COOLDOWN_S = 30;

export default function VerifyPage() {
  const router = useRouter();
  const pendingEmail = useAuthStore((s) => s.pendingEmail);
  const completeVerification = useAuthStore((s) => s.completeVerification);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = async (value: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.verifyCode(value);
      completeVerification();
      router.replace("/onboarding");
    } catch {
      toast.error("Verification failed", { description: "Try the code again." });
      setBusy(false);
      setCode("");
    }
  };

  const resend = async () => {
    setCooldown(RESEND_COOLDOWN_S);
    try {
      await api.resendCode();
      toast.success("A new code is on its way");
    } catch {
      toast.error("Couldn't resend the code");
      setCooldown(0);
    }
  };

  return (
    <div>
      <p className="eyebrow">
        <span className="eyebrow-dot" aria-hidden>
          •
        </span>
        check your inbox
      </p>
      <h1 className="page-title mt-3">Verify email</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        We sent a 6-digit code to{" "}
        <span className="text-foreground">{pendingEmail ?? "your email"}</span>.
      </p>

      <div className="mt-8">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(value) => {
            setCode(value);
            if (value.length === 6) void verify(value);
          }}
          disabled={busy}
          aria-label="6-digit verification code"
        >
          <InputOTPGroup className="gap-2">
            {[0, 1, 2, 3, 4, 5].map((slot) => (
              <InputOTPSlot
                key={slot}
                index={slot}
                className="size-12 rounded-lg border border-input text-lg first:rounded-l-lg last:rounded-r-lg"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {busy ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Verifying…
          </p>
        ) : null}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Didn&apos;t get it?{" "}
        <Button
          variant="link"
          className="h-auto p-0 text-sm"
          onClick={() => void resend()}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </Button>
      </p>
    </div>
  );
}
