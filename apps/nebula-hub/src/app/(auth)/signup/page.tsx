import { redirect } from "next/navigation";

/** Privy login creates accounts; keep /signup as a stable alias. */
export default function SignupRedirect() {
  redirect("/login");
}
