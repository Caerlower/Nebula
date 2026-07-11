export type HelpCategory =
  | "wallet"
  | "transfers"
  | "limits"
  | "policy"
  | "x402"
  | "mpp"
  | "treasury"
  | "identity";

export interface HelpToolEntry {
  name: string;
  summary: string;
  params?: string;
  tip?: string;
}

export interface HelpCategoryGroup {
  id: HelpCategory;
  title: string;
  description: string;
  tools: HelpToolEntry[];
}

export const HELP_CATEGORIES: HelpCategoryGroup[] = [
  {
    id: "wallet",
    title: "Wallet & dashboard",
    description: "Balances, address, funding, and the in-chat dashboard UI.",
    tools: [
      {
        name: "ping",
        summary: "Health check — confirms the MCP server is running.",
      },
      {
        name: "get_address",
        summary: "Return the wallet public key (G...) with StellarExpert link.",
      },
      {
        name: "check_balance",
        summary: "XLM and USDC balances on the configured network.",
      },
      {
        name: "wallet_dashboard",
        summary:
          "Interactive in-chat dashboard (MCP Apps): balances, limits, treasury, MPP, 8004.",
        tip: 'Try: "Use wallet_dashboard from Nebula"',
      },
      {
        name: "request_funding",
        summary:
          "Friendbot + Stellar Lab links (testnet) or mainnet funding instructions.",
      },
      {
        name: "help",
        summary: "Show this guide — all tools, env vars, and quick-start prompts.",
        params: "category? (wallet | transfers | limits | policy | x402 | mpp | treasury | identity)",
      },
    ],
  },
  {
    id: "transfers",
    title: "Transfers",
    description: "Send XLM or USDC. Subject to spending limits.",
    tools: [
      {
        name: "transfer_xlm",
        summary: "Send XLM to a Stellar address.",
        params: "destination (G...), amount",
      },
      {
        name: "transfer_usdc",
        summary: "Send USDC (requires trustline).",
        params: "destination (G...), amount",
      },
    ],
  },
  {
    id: "limits",
    title: "Spending limits",
    description: "Off-chain caps enforced before any agent spend signs.",
    tools: [
      {
        name: "spending_report",
        summary:
          "Per-call cap, daily cap, spent in rolling 24h, remaining budget.",
        tip: "Reads on-chain policy when POLICY_CONTRACT_ID is set.",
      },
    ],
  },
  {
    id: "policy",
    title: "On-chain policy (Soroban)",
    description:
      "Deploy and manage a nebula-policy contract for on-chain spending enforcement.",
    tools: [
      {
        name: "deploy_policy",
        summary: "Deploy + initialize nebula-policy. Returns POLICY_CONTRACT_ID.",
        params: "max_per_call?, max_per_day?",
      },
      {
        name: "get_policy_status",
        summary: "Read on-chain limits and rolling-window usage.",
      },
      {
        name: "set_policy_limits",
        summary: "Owner updates caps on-chain (no redeploy).",
        params: "max_per_call, max_per_day",
      },
    ],
  },
  {
    id: "x402",
    title: "x402 payments",
    description: "Pay per HTTP request with USDC when a server returns 402.",
    tools: [
      {
        name: "x402_fetch",
        summary: "GET a URL; on HTTP 402, pays USDC via x402 and retries.",
        params: "url",
        tip: 'Try: "Use x402_fetch from Nebula with url https://..."',
      },
    ],
  },
  {
    id: "mpp",
    title: "MPP sessions",
    description:
      "One on-chain deposit, many off-chain micropayments, settle once.",
    tools: [
      {
        name: "mpp_open_session",
        summary: "Deploy channel contract and deposit USDC budget on-chain.",
        params: "budget (USDC), recipient? (G...)",
      },
      {
        name: "mpp_status",
        summary: "Active session: channel, budget, committed spend, remaining.",
      },
      {
        name: "mpp_fetch",
        summary: "Pay an MPP-gated URL with off-chain commitments.",
        params: "url",
      },
      {
        name: "mpp_close_session",
        summary: "Settle on-chain — pay recipient, refund unused deposit.",
      },
    ],
  },
  {
    id: "treasury",
    title: "Treasury & yield (Blend)",
    description:
      "Auto-rebalance idle XLM/USDC into Blend. Background loop runs every 60s by default.",
    tools: [
      {
        name: "get_treasury_status",
        summary: "Liquid vs Blend balances, supply APY, threshold, last rebalance.",
      },
      {
        name: "set_liquidity_threshold",
        summary: "Minimum liquid balance; excess auto-deposits to Blend.",
        params: "threshold",
      },
      {
        name: "optimize_treasury",
        summary: "Trigger one rebalance immediately.",
      },
      {
        name: "blend_check_rates",
        summary: "Read-only Blend supply APY on testnet pools.",
      },
    ],
  },
  {
    id: "identity",
    title: "Agent identity (Stellar8004)",
    description: "On-chain agent registration and reputation.",
    tools: [
      {
        name: "register_identity",
        summary: "Mint 8004 agent identity for this wallet (idempotent).",
      },
      {
        name: "get_my_reputation",
        summary: "Feedback count, average score, unique clients.",
      },
    ],
  },
];

export const HELP_ENV_VARS: Array<{
  name: string;
  required: boolean;
  defaultValue?: string;
  purpose: string;
}> = [
  {
    name: "STELLAR_SECRET_KEY",
    required: true,
    purpose: "Wallet secret key (S...)",
  },
  {
    name: "NETWORK",
    required: false,
    defaultValue: "testnet",
    purpose: "testnet or mainnet",
  },
  {
    name: "MAX_PER_CALL",
    required: false,
    purpose: "Per-transfer/x402/MPP-open cap (off-chain mode)",
  },
  {
    name: "MAX_PER_DAY",
    required: false,
    purpose: "Rolling 24h cap (off-chain mode)",
  },
  {
    name: "POLICY_CONTRACT_ID",
    required: false,
    purpose: "On-chain Soroban policy (C...) — overrides off-chain limits",
  },
  {
    name: "TREASURY_ASSET",
    required: false,
    defaultValue: "xlm",
    purpose: "xlm or usdc for Blend treasury",
  },
  {
    name: "LIQUIDITY_THRESHOLD",
    required: false,
    defaultValue: "10",
    purpose: "Min liquid balance before depositing to Blend",
  },
  {
    name: "REBALANCE_INTERVAL_SECONDS",
    required: false,
    defaultValue: "60",
    purpose: "Background treasury loop interval",
  },
  {
    name: "MPP_RECIPIENT",
    required: false,
    purpose: "Default G... for MPP channel payouts",
  },
];

export const HELP_QUICK_START = [
  "Use help from Nebula",
  "Use wallet_dashboard from Nebula",
  "Use request_funding from Nebula",
  "Use check_balance from Nebula",
  "Use spending_report from Nebula",
  "Use get_treasury_status from Nebula",
];

export const HELP_CATEGORY_IDS: HelpCategory[] = HELP_CATEGORIES.map(
  (c) => c.id,
);

export function findHelpCategory(
  id: string,
): HelpCategoryGroup | undefined {
  return HELP_CATEGORIES.find((c) => c.id === id);
}
