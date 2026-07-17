import { clearSessionCookie } from "@/lib/wallet-auth";

/** Clear the wallet session cookie. */
export async function POST() {
  return Response.json(
    { status: "ok" },
    { headers: { "Set-Cookie": clearSessionCookie() } },
  );
}
