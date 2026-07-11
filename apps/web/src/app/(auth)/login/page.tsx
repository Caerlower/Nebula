"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { BadgeCheck, Github, Loader2 } from "lucide-react";

import { fetchBetaStatus, redeemBetaCode } from "@/lib/beta-client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  code: z.string(),
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

export default function LoginPage() {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const [oauthBusy, setOauthBusy] = useState<"google" | "github" | null>(null);
  const [betaGranted, setBetaGranted] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", code: "" },
  });

  useEffect(() => {
    void fetchBetaStatus().then(setBetaGranted);
  }, []);

  /** Private beta: an invite code must be redeemed before any sign-in path. */
  const ensureBetaAccess = async (): Promise<boolean> => {
    if (betaGranted) return true;
    const code = form.getValues("code").trim();
    if (!code) {
      form.setError("code", { message: "Nebula is in private beta — enter your invite code" });
      return false;
    }
    try {
      const ok = await redeemBetaCode(code);
      if (!ok) {
        form.setError("code", { message: "That code isn't valid" });
        return false;
      }
      setBetaGranted(true);
      return true;
    } catch {
      toast.error("Couldn't verify the invite code", { description: "Please try again." });
      return false;
    }
  };

  const submit = async (values: Values) => {
    if (!(await ensureBetaAccess())) return;
    try {
      const user = await api.login(values.email, values.password);
      signIn(user);
      router.replace("/dashboard");
    } catch {
      toast.error("Sign-in failed", { description: "Check your email and password." });
    }
  };

  const oauth = async (provider: "google" | "github") => {
    if (!(await ensureBetaAccess())) return;
    setOauthBusy(provider);
    try {
      const user = await api.oauthLogin(provider);
      signIn(user);
      router.replace("/dashboard");
    } catch {
      toast.error(`Couldn't continue with ${provider === "google" ? "Google" : "GitHub"}`);
    } finally {
      setOauthBusy(null);
    }
  };

  return (
    <div>
      <p className="eyebrow">
        <span className="eyebrow-dot" aria-hidden>
          •
        </span>
        welcome back
      </p>
      <h1 className="page-title mt-3">Sign in</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Manage your agent&apos;s wallet, policy, and yield.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="mt-8 space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="you@company.dev" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link
                    href="/forgot"
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <Input type="password" autoComplete="current-password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {betaGranted ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-success">
              <BadgeCheck className="size-3.5" aria-hidden /> Private beta access active on this
              browser
            </p>
          ) : (
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invite code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="NEBULA-XXXX"
                      autoComplete="off"
                      className="font-mono uppercase"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Nebula is in private beta. No code yet?{" "}
                    <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">
                      Join the waitlist
                    </Link>
                    .
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>
      </Form>

      <div className="my-6 flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-2.5">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void oauth("google")}
          disabled={oauthBusy !== null}
          aria-label="Continue with Google"
        >
          {oauthBusy === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
          Continue with Google
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void oauth("github")}
          disabled={oauthBusy !== null}
          aria-label="Continue with GitHub"
        >
          {oauthBusy === "github" ? <Loader2 className="size-4 animate-spin" /> : <Github className="size-4" />}
          Continue with GitHub
        </Button>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        New to Nebula?{" "}
        <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
