"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";

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

const schema = z.object({ email: z.string().email("Enter a valid email") });
type Values = z.infer<typeof schema>;

export default function ForgotPage() {
  const router = useRouter();
  const [sent, setSent] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => router.push("/reset"), 2000);
    return () => clearTimeout(timer);
  }, [sent, router]);

  const submit = async (values: Values) => {
    try {
      await api.requestPasswordReset(values.email);
      setSent(true);
    } catch {
      toast.error("Couldn't send the reset link", { description: "Please try again." });
    }
  };

  if (sent) {
    return (
      <div>
        <MailCheck className="size-8 text-success" aria-hidden />
        <h1 className="page-title mt-4">Check your inbox</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          We sent a reset link to {form.getValues("email")}. Taking you to the reset page…
        </p>
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
      <h1 className="page-title mt-3">Forgot password</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Enter your email and we&apos;ll send a reset link.
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
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Send reset link
          </Button>
        </form>
      </Form>

      <p className="mt-8 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
