"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { BadgeCheck, Loader2 } from "lucide-react";

import { PasswordStrength } from "@/components/auth/password-strength";
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

const schema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
    code: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

type Values = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const setPendingEmail = useAuthStore((s) => s.setPendingEmail);
  const [betaGranted, setBetaGranted] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", confirm: "", code: "" },
  });

  const password = form.watch("password");

  useEffect(() => {
    void fetchBetaStatus().then(setBetaGranted);
  }, []);

  const submit = async (values: Values) => {
    // Private beta: signup needs a valid invite code first.
    if (!betaGranted) {
      const code = values.code.trim();
      if (!code) {
        form.setError("code", { message: "Nebula is in private beta — enter your invite code" });
        return;
      }
      try {
        const ok = await redeemBetaCode(code);
        if (!ok) {
          form.setError("code", { message: "That code isn't valid" });
          return;
        }
        setBetaGranted(true);
      } catch {
        toast.error("Couldn't verify the invite code", { description: "Please try again." });
        return;
      }
    }
    try {
      await api.signup(values.email, values.password);
      setPendingEmail(values.email);
      router.push("/verify");
    } catch {
      toast.error("Sign-up failed", { description: "Please try again." });
    }
  };

  return (
    <div>
      <p className="eyebrow">
        <span className="eyebrow-dot" aria-hidden>
          •
        </span>
        get started
      </p>
      <h1 className="page-title mt-3">Create account</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        A wallet for your agent in about two minutes.
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
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
                </FormControl>
                <PasswordStrength password={password} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
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
            Create account
          </Button>
        </form>
      </Form>

      <p className="mt-8 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
