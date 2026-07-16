import { z } from "zod";

import type { ToolContext, ToolResult } from "../types/context.js";

export const checkBalanceSchema = z.object({});

export type CheckBalanceInput = z.infer<typeof checkBalanceSchema>;

export const checkBalanceTool = {
  name: "check_balance" as const,
  description: "Return XLM (and USDC if present) balances for the user's Hub wallet.",
  schema: checkBalanceSchema,
  async handler(
    _input: CheckBalanceInput,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    return {
      status: "ok",
      data: {
        address: ctx.stellarAddress,
        network: ctx.network,
      },
      message:
        "check_balance: Hub must hydrate balances. Core returns address context only.",
    };
  },
};

export const getAddressSchema = z.object({});

export const getAddressTool = {
  name: "get_address" as const,
  description: "Return the Stellar public address for this Nebula wallet.",
  schema: getAddressSchema,
  async handler(
    _input: z.infer<typeof getAddressSchema>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    return {
      status: "ok",
      data: { address: ctx.stellarAddress, network: ctx.network },
      message: ctx.stellarAddress,
    };
  },
};

export const pingSchema = z.object({});

export const pingTool = {
  name: "ping" as const,
  description: "Health check — confirms Nebula tools are reachable for this user.",
  schema: pingSchema,
  async handler(
    _input: z.infer<typeof pingSchema>,
    _ctx: ToolContext,
  ): Promise<ToolResult> {
    return {
      status: "ok",
      message: `Nebula is alive\n${new Date().toISOString()}`,
    };
  },
};

export const requestFundingSchema = z.object({});

export const requestFundingTool = {
  name: "request_funding" as const,
  description: "Return Friendbot / funding instructions for the wallet address.",
  schema: requestFundingSchema,
  async handler(
    _input: z.infer<typeof requestFundingSchema>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const friendbot =
      ctx.network === "testnet"
        ? `https://friendbot.stellar.org?addr=${ctx.stellarAddress}`
        : null;
    return {
      status: "ok",
      data: {
        address: ctx.stellarAddress,
        network: ctx.network,
        friendbot_url: friendbot,
      },
      message: friendbot
        ? `Fund testnet wallet via Friendbot:\n${friendbot}`
        : `Mainnet wallet ${ctx.stellarAddress} — fund via an exchange or existing Stellar account.`,
    };
  },
};
