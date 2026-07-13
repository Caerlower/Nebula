import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { BETA_COOKIE, BETA_COOKIE_MAX_AGE_S, isValidBetaCode } from "@/lib/beta";

/** GET → is this browser already inside the private beta? */
export async function GET() {
  const store = await cookies();
  const granted = isValidBetaCode(store.get(BETA_COOKIE)?.value);
  return NextResponse.json({ granted });
}

/** POST { code } → validate the invite code and grant the beta cookie. */
export async function POST(request: Request) {
  let code: unknown;
  try {
    ({ code } = (await request.json()) as { code?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof code !== "string" || !isValidBetaCode(code)) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 401 });
  }

  const response = NextResponse.json({ granted: true });
  response.cookies.set(BETA_COOKIE, code.trim().toUpperCase(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BETA_COOKIE_MAX_AGE_S,
  });
  return response;
}
