import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { BETA_COOKIE, isValidBetaCode } from "@/lib/beta";
import { getSupabaseAdmin } from "@/lib/db";

/**
 * Waitlist signups land in the Supabase `waitlist` table when SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY are configured; otherwise they fall back to a
 * local JSONL file so dev keeps working without keys.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const WAITLIST_FILE = path.join(DATA_DIR, "waitlist.jsonl");

const EMAIL_RE = /^\S+@\S+\.\S+$/;

interface WaitlistEntry {
  email: string;
  source: string;
  at: string;
}

/** Postgres unique-violation — an email that's already on the list is a success. */
const UNIQUE_VIOLATION = "23505";

export async function POST(request: Request) {
  let body: { email?: unknown; source?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const entry: WaitlistEntry = {
    email,
    source: typeof body.source === "string" ? body.source : "unknown",
    at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase
      .from("waitlist")
      .insert({ email: entry.email, source: entry.source });
    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error("[waitlist] supabase insert failed:", error.message);
      return NextResponse.json({ error: "Couldn't save your email" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // No Supabase configured — local dev fallback.
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await appendFile(WAITLIST_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (err) {
    console.log("[waitlist]", JSON.stringify(entry), err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ ok: true });
}

/** GET → list signups. Beta members only (that's you). */
export async function GET() {
  const store = await cookies();
  if (!isValidBetaCode(store.get(BETA_COOKIE)?.value)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("waitlist")
      .select("email, source, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[waitlist] supabase read failed:", error.message);
      return NextResponse.json({ error: "Couldn't load the waitlist" }, { status: 500 });
    }
    const entries: WaitlistEntry[] = (data ?? []).map((row) => ({
      email: row.email as string,
      source: (row.source as string | null) ?? "unknown",
      at: row.created_at as string,
    }));
    return NextResponse.json({ count: entries.length, entries, store: "supabase" });
  }

  try {
    const raw = await readFile(WAITLIST_FILE, "utf8");
    const entries = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as WaitlistEntry);
    return NextResponse.json({ count: entries.length, entries, store: "file" });
  } catch {
    return NextResponse.json({ count: 0, entries: [], store: "file" });
  }
}
