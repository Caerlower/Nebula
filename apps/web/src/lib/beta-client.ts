"use client";

/** Client side of the private-beta gate (see src/lib/beta.ts). */

export async function fetchBetaStatus(): Promise<boolean> {
  try {
    const res = await fetch("/api/beta", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { granted?: boolean };
    return data.granted === true;
  } catch {
    return false;
  }
}

/** Returns true when the code was accepted (cookie now set). */
export async function redeemBetaCode(code: string): Promise<boolean> {
  const res = await fetch("/api/beta", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (res.status === 401) return false;
  if (!res.ok) throw new Error("Beta check failed");
  return true;
}
