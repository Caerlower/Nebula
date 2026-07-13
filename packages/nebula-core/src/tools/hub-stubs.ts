import { z } from "zod";

import type { ToolContext, ToolResult } from "../types/context.js";

async function hubOnly(name: string): Promise<ToolResult> {
  return {
    status: "error",
    reason: `${name} must be executed by the Hub.`,
  };
}

/** Short polls only — Hub is serverless-friendly. Clients should re-call while pending. */
export const awaitConfirmationSchema = z.object({
  confirmation_id: z.string().min(1),
  /** How long to poll this call (default 15s, max 25s). Re-call if still pending. */
  timeout_seconds: z.number().int().positive().max(25).optional(),
});

export const awaitConfirmationTool = {
  name: "await_confirmation" as const,
  description:
    "Poll a pending human confirmation briefly (max 25s). If still pending, call again with the same confirmation_id until approved/rejected/expired. Use after any tool returns confirmation_required.",
  schema: awaitConfirmationSchema,
  async handler(
    _input: z.infer<typeof awaitConfirmationSchema>,
    _ctx: ToolContext,
  ): Promise<ToolResult> {
    return hubOnly("await_confirmation");
  },
};

export const registerIdentitySchema = z.object({});
export const getMyReputationSchema = z.object({});

export const registerIdentityTool = {
  name: "register_identity" as const,
  description:
    "Register this wallet as an on-chain Stellar8004 (ERC-8004) agent identity. Signs via Hub/Privy, returns agent ID + explorer links. Idempotent if already registered. Reputation avgScore is 0–100 from feedback.",
  schema: registerIdentitySchema,
  handler: async (
    _i: z.infer<typeof registerIdentitySchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("register_identity"),
};

export const getMyReputationTool = {
  name: "get_my_reputation" as const,
  description:
    "Read live Stellar8004 reputation for this wallet (explorer, falling back on-chain). Returns avgScore 0–100, feedbackCount, uniqueClients.",
  schema: getMyReputationSchema,
  handler: async (
    _i: z.infer<typeof getMyReputationSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("get_my_reputation"),
};
