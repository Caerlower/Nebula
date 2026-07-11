"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";

import { PasswordStrength } from "@/components/auth/password-strength";
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

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

type Values = z.infer<typeof schema>;

export default function ResetPage() {
  const [done, setDone] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const password = form.watch("password");

  const submit = async (values: Values) => {
    try {
      await api.resetPassword(values.password);
      setDone(true);
    } catch {
      toast.error("Couldn't reset the password", { description: "Please try again." });
    }
  };

  if (done) {
    return (
      <div>
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <h1 className="page-title mt-4">Password updated</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Your new password is set. Sign in to continue.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">
        <span className="eyebrow-dot" aria-hidden>
          •
        </span>
        reset access
      </p>
      <h1 className="page-title mt-3">Set new password</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">Pick something strong and new.</p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="mt-8 space-y-4" noValidate>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
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
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Reset password
          </Button>
        </form>
      </Form>
    </div>
  );
}
