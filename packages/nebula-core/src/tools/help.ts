import { z } from "zod";

import type { ToolContext, ToolResult } from "../types/context.js";

export const helpCategorySchema = z.enum([
  "wallet",
  "transfers",
  "limits",
  "policy",
  "x402",
  "mpp",
  "treasury",
  "identity",
  "approvals",
]);

export const helpSchema = z.object({
  category: helpCategorySchema.optional(),
});

/** Catalog used by Hub `help` (and MCP discovery). */
export const HELP_CATALOG: Record<
  z.infer<typeof helpCategorySchema>,
  Array<{ name: string; summary: string }>
> = {
  wallet: [
    { name: "ping", summary: "Health check" },
    { name: "get_address", summary: "Stellar G-address for this wallet" },
    { name: "check_balance", summary: "XLM / USDC balances" },
    { name: "request_funding", summary: "Friendbot / funding instructions (testnet)" },
  ],
  transfers: [
    {
      name: "transfer",
      summary: "Send XLM (policy + confirmation; Privy signs on Hub)",
    },
  ],
  limits: [
    {
      name: "spending_report",
      summary: "Last 24h confirmed transactions (activity log + totals by type)",
    },
    {
      name: "get_policy_status",
      summary: "Policy USDC caps, category limits, treasury USDC band, pause, lists",
    },
  ],
  policy: [
    {
      name: "get_policy_status",
      summary: "Read-only USDC policy caps. Edit in Hub dashboard (not via MCP).",
    },
    {
      name: "spending_report",
      summary: "24h activity ledger — separate from policy caps",
    },
  ],
  x402: [
    {
      name: "x402_fetch",
      summary:
        "GET a URL; on 402 pay USDC automatically. max_amount_usdc optional (defaults to Hub x402/per-tx cap).",
    },
    {
      name: "x402_pay",
      summary: "Pay a known USDC amount for an x402 URL",
    },
  ],
  mpp: [
    {
      name: "mpp_open_session",
      summary:
        "Open USDC payment channel. Returns a Hub demo_url — no local merchant server needed for demos.",
    },
    {
      name: "mpp_fetch",
      summary: "Pay an MPP-gated URL with off-chain commitments (use demo_url from open).",
    },
    { name: "mpp_status", summary: "Open session budget / committed / remaining" },
    { name: "mpp_close_session", summary: "Settle on-chain and refund unused deposit" },
  ],
  treasury: [
    { name: "get_treasury_status", summary: "Liquid vs Blend XLM + USDC band + APY" },
    { name: "blend_check_rates", summary: "Blend supply APY" },
    // deposit / withdraw / optimize are Hub-dashboard only (not MCP)
  ],
  identity: [
    {
      name: "register_identity",
      summary:
        "Mint on-chain Stellar8004 identity for this wallet (Privy-signed). Idempotent.",
    },
    {
      name: "get_my_reputation",
      summary:
        "Read live Stellar8004 reputation (avgScore 0–100, feedback, clients)",
    },
  ],
  approvals: [
    {
      name: "await_confirmation",
      summary:
        "Short-poll confirmation_id (max 25s). Re-call while pending after confirmation_required",
    },
  ],
};

export const helpTool = {
  name: "help" as const,
  description:
    "Show Nebula tool catalog by category and how confirmations / Hub policy work.",
  schema: helpSchema,
  async handler(
    input: z.infer<typeof helpSchema>,
    _ctx: ToolContext,
  ): Promise<ToolResult> {
    const cats = input.category
      ? [input.category]
      : (Object.keys(HELP_CATALOG) as Array<keyof typeof HELP_CATALOG>);
    const lines: string[] = [
      "Nebula · Help",
      "",
      "Keys stay on the Hub. MCP only uses NEBULA_TOKEN.",
      "Policy caps are edited in the Hub dashboard (shared across agents today).",
      "If a tool returns confirmation_required, call await_confirmation with that id.",
      "",
    ];
    for (const cat of cats) {
      lines.push(`## ${cat}`);
      for (const t of HELP_CATALOG[cat]) {
        lines.push(`- ${t.name}: ${t.summary}`);
      }
      lines.push("");
    }
    return { status: "ok", message: lines.join("\n").trim() };
  },
};
