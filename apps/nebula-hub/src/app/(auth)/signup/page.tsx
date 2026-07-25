"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useLoginWithEmail,
  useLoginWithOAuth,
  usePrivy,
} from "@privy-io/react-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { BadgeCheck, Github, Loader2, Wallet } from "lucide-react";

import { AuthSplash } from "@/components/shared/auth-splash";
import { SectionRule } from "@/components/design/primitives";
import { fetchBetaStatus, redeemBetaCode } from "@/lib/auth/beta";
import { syncHubSession } from "@/lib/auth/session";
import { applyPrivySession } from "@/lib/auth/session";
import { signInWithFreighter, WalletConnectError } from "@/lib/wallet/connect";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  code: z.string(),
  invite: z.string(),
});

type Values = z.infer<typeof schema>;

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
      <path d="M21.6 12.2c0-.7-.06-1.4-.18-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" />
      <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path d="M6.4 14a6 6 0 0 1 0-3.8V7.6H3.1a10 10 0 0 0 0 8.9L6.4 14Z" />
      <path d="M12 6c1.5 0 2.8.5 3.8 1.5L18.7 5A10 10 0 0 0 3 7.6L6.4 10c.8-2.3 3-4 5.6-4Z" />
    </svg>
  );
}


function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useAuthStore((s) => s.hydrated);
  const { ready, authenticated, user } = usePrivy();
  const redirected = useRef(false);

  const oauthReturn =
    searchParams.has("privy_oauth_code") ||
    searchParams.has("privy_oauth_state");

  const [oauthBusy, setOauthBusy] = useState<"google" | "github" | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [betaGranted, setBetaGranted] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const signInWallet = useAuthStore((s) => s.signInWallet);

  const goToOnboarding = useRef(() => {
    if (redirected.current) return;
    redirected.current = true;
    void syncHubSession().catch((error) => {
      console.error("[signup] hub session sync", error);
    });
    // Client-side navigation keeps the Privy provider alive — a full reload
    // here re-initializes Privy and stalls on a loading screen for seconds.
    router.replace("/onboarding");
  });

  const onAuthComplete = useRef(() => {});
  onAuthComplete.current = () => {
    if (!user || !hydrated) return;
    applyPrivySession(user, { onboarded: false });
    goToOnboarding.current();
  };

  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({
    onComplete: () => onAuthComplete.current(),
    onError: (error) => {
      setOauthBusy(null);
      redirected.current = false;
      toast.error("Couldn't create account", { description: String(error) });
    },
  });
  const { initOAuth, state: oauthState } = useLoginWithOAuth({
    onComplete: () => onAuthComplete.current(),
    onError: (error) => {
      setOauthBusy(null);
      redirected.current = false;
      toast.error("OAuth failed", { description: String(error) });
    },
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema as never),
    defaultValues: { email: "", code: "", invite: "" },
  });

  useEffect(() => {
    void fetchBetaStatus().then(setBetaGranted);
  }, []);

  useEffect(() => {
    if (!ready || !hydrated || !authenticated || !user) return;
    applyPrivySession(user, { onboarded: false });
    goToOnboarding.current();
  }, [ready, hydrated, authenticated, user]);

  useEffect(() => {
    if (!oauthReturn || !ready || !hydrated) return;
    if (authenticated) return;
    const t = window.setTimeout(() => {
      setOauthBusy(null);
      router.replace("/signup");
      toast.error("Google sign-up didn't finish", {
        description: "Please try again.",
      });
    }, 20000);
    return () => window.clearTimeout(t);
  }, [oauthReturn, ready, hydrated, authenticated, router]);

  const ensureBetaAccess = async (): Promise<boolean> => {
    if (betaGranted) return true;
    const invite = form.getValues("invite").trim();
    if (!invite) {
      form.setError("invite", {
        message: "Nebula is in private beta — enter your invite code",
      });
      return false;
    }
    try {
      const ok = await redeemBetaCode(invite);
      if (!ok) {
        form.setError("invite", { message: "That code isn't valid" });
        return false;
      }
      setBetaGranted(true);
      return true;
    } catch {
      toast.error("Couldn't verify the invite code");
      return false;
    }
  };

  const onSendCode = async () => {
    if (!(await ensureBetaAccess())) return;
    const email = form.getValues("email");
    if (!z.string().email().safeParse(email).success) {
      form.setError("email", { message: "Enter a valid email" });
      return;
    }
    setSendingCode(true);
    try {
      await sendCode({ email });
      setCodeSent(true);
      toast.success("Check your email for a login code");
    } catch {
      toast.error("Couldn't send login code");
    } finally {
      setSendingCode(false);
    }
  };

  const submit = async (values: Values) => {
    if (!(await ensureBetaAccess())) return;
    if (!codeSent) {
      await onSendCode();
      return;
    }
    if (!values.code.trim()) {
      form.setError("code", { message: "Enter the code from your email" });
      return;
    }
    try {
      await loginWithCode({ code: values.code.trim() });
    } catch {
      toast.error("Couldn't create your account");
    }
  };

  const oauth = async (provider: "google" | "github") => {
    if (!(await ensureBetaAccess())) return;
    setOauthBusy(provider);
    try {
      await initOAuth({ provider });
    } catch {
      setOauthBusy(null);
      toast.error(
        `Couldn't continue with ${provider === "google" ? "Google" : "GitHub"}`,
      );
    }
  };

  const connectWallet = async () => {
    if (!(await ensureBetaAccess())) return;
    if (redirected.current) return;
    setWalletBusy(true);
    try {
      const { address } = await signInWithFreighter();
      const short = `${address.slice(0, 4)}…${address.slice(-4)}`;
      signInWallet(address, { name: short, email: "" });
      redirected.current = true;
      void syncHubSession().catch((error) => {
        console.error("[signup] hub session sync", error);
      });
      router.replace("/agents");
    } catch (error) {
      const description =
        error instanceof WalletConnectError
          ? error.message
          : "Couldn't connect your wallet. Please try again.";
      toast.error("Wallet sign-in failed", { description });
    } finally {
      setWalletBusy(false);
    }
  };

  const emailBusy =
    emailState.status === "sending-code" ||
    emailState.status === "submitting-code" ||
    form.formState.isSubmitting;

  const showSpinner =
    oauthReturn ||
    oauthBusy !== null ||
    emailState.status === "submitting-code" ||
    (ready && authenticated && !!user);

  if (showSpinner)
    return (
      <AuthSplash title="Creating your account" detail="Setting things up — almost there." />
    );

  if (!ready || !hydrated) {
    return <AuthSplash title="One moment" detail="Loading your session…" />;
  }

  return (
    <div>
      <SectionRule>GET STARTED</SectionRule>
      <h1 className="page-title">Create account</h1>
      <p className="mt-3 max-w-sm text-[14px] text-pretty text-muted-foreground">
        One Privy login creates your Nebula wallet — no seed phrases.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(submit)}
          className="mt-8 space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.dev"
                    className="h-11 rounded-xl border-border bg-[var(--panel-3)] font-mono text-[13px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                    Login code
                  </FormLabel>
                  <button
                    type="button"
                    className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    disabled={sendingCode || emailBusy}
                    onClick={() => void onSendCode()}
                  >
                    {sendingCode
                      ? "SENDING…"
                      : codeSent
                        ? "RESEND"
                        : "SEND CODE"}
                  </button>
                </div>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    className="h-11 rounded-xl border-border bg-[var(--panel-3)] font-mono text-[13px] tracking-[0.2em]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {betaGranted ? (
            <p className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.04em] text-success">
              <BadgeCheck className="size-3.5" aria-hidden /> Private beta
              access active on this browser
            </p>
          ) : (
            <FormField
              control={form.control}
              name="invite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                    Invite code
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="NEBULA-XXXX"
                      autoComplete="off"
                      className="h-11 rounded-xl border-border bg-[var(--panel-3)] font-mono text-[13px] uppercase"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <button
            type="submit"
            disabled={emailBusy}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold disabled:opacity-60"
            style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
          >
            {emailBusy ? <Loader2 className="size-4 animate-spin" /> : null}
            {codeSent ? "Create account" : "Send code & continue"}
          </button>
        </form>
      </Form>

      <div className="my-7 flex items-center gap-3 font-mono text-[10px] tracking-[0.14em] text-subtle">
        <span className="h-px flex-1 bg-border" />
        OR
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => void oauth("google")}
          disabled={oauthBusy !== null}
          aria-label="Continue with Google"
          className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-transparent text-[13px] text-foreground hover:bg-elevated/60 disabled:opacity-60"
        >
          {oauthBusy === "google" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <GoogleMark />
          )}
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => void oauth("github")}
          disabled={oauthBusy !== null}
          aria-label="Continue with GitHub"
          className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-transparent text-[13px] text-foreground hover:bg-elevated/60 disabled:opacity-60"
        >
          {oauthBusy === "github" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Github className="size-4" />
          )}
          Continue with GitHub
        </button>
        <button
          type="button"
          onClick={() => void connectWallet()}
          disabled={walletBusy || oauthBusy !== null}
          aria-label="Continue with Freighter wallet"
          className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-transparent text-[13px] text-foreground hover:bg-elevated/60 disabled:opacity-60"
        >
          {walletBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wallet className="size-4" />
          )}
          Continue with Freighter
        </button>
      </div>

      <p className="mt-8 text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthSplash title="One moment" detail="Loading your session…" />}>
      <SignupForm />
    </Suspense>
  );
}
