import type {
  Agent,
  ApiKey,
  AppNotification,
  BalancePoint,
  BillingInfo,
  BlendPosition,
  Invoice,
  NotificationPrefs,
  Policy,
  Reputation,
  TeamMember,
  Transaction,
  TreasurySettings,
  TxStatus,
  TxType,
  WalletSummary,
  Webhook,
  Workspace,
} from "@/mocks/types";

/* ------------------------- deterministic PRNG ------------------------- */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0x5eb01a);

const STRKEY_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function strkey(prefix: "G" | "C"): string {
  let out = prefix;
  for (let i = 0; i < 55; i++) {
    out += STRKEY_ALPHABET[Math.floor(rng() * STRKEY_ALPHABET.length)];
  }
  return out;
}

function txHash(): string {
  const hexAlphabet = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 64; i++) {
    out += hexAlphabet[Math.floor(rng() * 16)];
  }
  return out;
}

const NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function iso(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString();
}

/* ------------------------------- wallet ------------------------------- */

export const walletAddress = strkey("G");
export const policyContractId = strkey("C");

/** 90 days of hourly balance history — a gentle upward random walk. */
export const balanceHistory: BalancePoint[] = (() => {
  const points: BalancePoint[] = [];
  const hours = 90 * 24;
  let balance = 9_180;
  let cumYield = 0;
  for (let i = hours; i >= 0; i--) {
    const drift = (rng() - 0.44) * 42;
    balance = Math.max(2_400, balance + drift);
    cumYield += 0.14 + rng() * 0.12;
    points.push({
      time: iso(i * HOUR),
      balance: Math.round(balance * 100) / 100,
      yield: Math.round(cumYield * 100) / 100,
    });
  }
  return points;
})();

const latest = balanceHistory[balanceHistory.length - 1]!;
const dayAgoPoint = balanceHistory[balanceHistory.length - 25]!;
const monthAgoPoint = balanceHistory[balanceHistory.length - 1 - 30 * 24]!;

export const wallet: WalletSummary = {
  address: walletAddress,
  balanceXLM: latest.balance,
  change24hPct:
    Math.round(((latest.balance - dayAgoPoint.balance) / dayAgoPoint.balance) * 10_000) / 100,
  idleXLM: Math.round(latest.balance * 0.62 * 100) / 100,
  apyPct: 6.84,
  yield30dXLM: Math.round((latest.yield - monthAgoPoint.yield) * 100) / 100,
  spendTodayUSD: 61.4,
};

/* ------------------------------- agents ------------------------------- */

export const agents: Agent[] = [
  {
    id: "agt_atlas",
    name: "Atlas",
    framework: "claude-code",
    status: "active",
    address: strkey("G"),
    balanceXLM: 4_812.6,
    txToday: 14,
    lastActive: iso(4 * 60_000),
    createdAt: iso(74 * DAY),
  },
  {
    id: "agt_scout",
    name: "Scout",
    framework: "claude-desktop",
    status: "active",
    address: strkey("G"),
    balanceXLM: 2_204.1,
    txToday: 6,
    lastActive: iso(38 * 60_000),
    createdAt: iso(51 * DAY),
  },
  {
    id: "agt_broker",
    name: "Broker",
    framework: "custom-mcp",
    status: "paused",
    address: strkey("G"),
    balanceXLM: 3_390.4,
    txToday: 0,
    lastActive: iso(2 * DAY),
    createdAt: iso(33 * DAY),
  },
  {
    id: "agt_sentinel",
    name: "Sentinel",
    framework: "openai-sdk",
    status: "offline",
    address: strkey("G"),
    balanceXLM: 512.9,
    txToday: 0,
    lastActive: iso(9 * DAY),
    createdAt: iso(21 * DAY),
  },
];

/* ---------------------------- transactions ---------------------------- */

const COUNTERPARTIES = Array.from({ length: 9 }, () => strkey("G"));

const TYPE_POOL: TxType[] = [
  "x402",
  "x402",
  "x402",
  "x402",
  "transfer",
  "transfer",
  "mpp",
  "mpp",
  "blend_deposit",
  "blend_withdraw",
];

const MEMOS = [
  null,
  null,
  null,
  "api credits",
  "data feed",
  "inference batch",
  "settlement",
  null,
  "weekly rebalance",
];

function opsFor(type: TxType, amount: number, asset: string) {
  switch (type) {
    case "x402":
      return [
        { type: "payment", detail: `${amount} ${asset} via x402 header` },
        { type: "receipt", detail: "402 → 200, resource unlocked" },
      ];
    case "mpp":
      return [
        { type: "channel_update", detail: `micropayment tick ${amount} ${asset}` },
      ];
    case "blend_deposit":
      return [
        { type: "invoke_contract", detail: "blend_pool.submit(deposit)" },
        { type: "transfer", detail: `${amount} ${asset} → pool` },
      ];
    case "blend_withdraw":
      return [
        { type: "invoke_contract", detail: "blend_pool.submit(withdraw)" },
        { type: "transfer", detail: `pool → ${amount} ${asset}` },
      ];
    case "transfer":
      return [{ type: "payment", detail: `${amount} ${asset} native transfer` }];
  }
}

export const transactions: Transaction[] = (() => {
  const list: Transaction[] = [];
  for (let i = 0; i < 150; i++) {
    const type = TYPE_POOL[Math.floor(rng() * TYPE_POOL.length)]!;
    const agent = agents[Math.floor(rng() * (i < 12 ? 2 : agents.length))]!;
    const asset = type === "x402" || type === "mpp" ? "USDC" : "XLM";
    const amount =
      type === "x402"
        ? Math.round((0.5 + rng() * 11.5) * 100) / 100
        : type === "mpp"
          ? Math.round((0.05 + rng() * 3.95) * 1000) / 1000
          : type === "transfer"
            ? Math.round((5 + rng() * 115) * 100) / 100
            : Math.round((50 + rng() * 350) * 100) / 100;
    const ageMs = Math.floor(rng() * rng() * 30 * DAY);
    const status: TxStatus =
      i < 2 ? "pending" : rng() < 0.045 ? "failed" : "confirmed";
    const outbound = type !== "blend_withdraw";
    const counterparty =
      type === "blend_deposit" || type === "blend_withdraw"
        ? COUNTERPARTIES[0]!
        : COUNTERPARTIES[Math.floor(rng() * COUNTERPARTIES.length)]!;
    list.push({
      id: `tx_${i.toString().padStart(4, "0")}`,
      hash: txHash(),
      time: iso(ageMs),
      agentId: agent.id,
      type,
      from: outbound ? agent.address : counterparty,
      to: outbound ? counterparty : agent.address,
      amount,
      asset,
      status,
      fee: Math.round((0.00001 + rng() * 0.00009) * 100_000) / 100_000,
      memo: MEMOS[Math.floor(rng() * MEMOS.length)] ?? null,
      operations: opsFor(type, amount, asset),
    });
  }
  return list.sort((a, b) => (a.time < b.time ? 1 : -1));
})();

/* ------------------------------ treasury ------------------------------ */

export const blendPositions: BlendPosition[] = [
  {
    id: "pos_1",
    pool: "Blend USDC Prime",
    asset: "USDC",
    deposited: 2_150,
    apyPct: 8.12,
    earned: 96.41,
  },
  {
    id: "pos_2",
    pool: "Blend XLM Core",
    asset: "XLM",
    deposited: 3_600,
    apyPct: 6.84,
    earned: 201.77,
  },
  {
    id: "pos_3",
    pool: "Blend Stable Yield",
    asset: "USDC",
    deposited: 780,
    apyPct: 5.4,
    earned: 18.09,
  },
];

export const treasurySettings: TreasurySettings = {
  autoYield: true,
  liquidityFloorXLM: 1_500,
};

/* ------------------------------- policy ------------------------------- */

export const policy: Policy = {
  contractId: policyContractId,
  dailyCapUSD: 100,
  weeklyCapUSD: 500,
  monthlyCapUSD: 1_500,
  categories: {
    x402: 50,
    mpp: 25,
    blend: 1_000,
    transfer: 200,
  },
  entries: [
    {
      id: "pe_1",
      address: COUNTERPARTIES[1]!,
      label: "Anthropic API settlement",
      kind: "allow",
      addedAt: iso(40 * DAY),
    },
    {
      id: "pe_2",
      address: COUNTERPARTIES[2]!,
      label: "Data vendor — Nightowl Feeds",
      kind: "allow",
      addedAt: iso(28 * DAY),
    },
    {
      id: "pe_3",
      address: COUNTERPARTIES[3]!,
      label: "Flagged drainer",
      kind: "deny",
      addedAt: iso(12 * DAY),
    },
  ],
  paused: false,
};

export const agentPolicyOverrides: Record<string, { dailyCapUSD: number | null; perTxCapUSD: number | null; note: string }> = {
  agt_atlas: { dailyCapUSD: 80, perTxCapUSD: 25, note: "Primary coding agent — near-global limits." },
  agt_scout: { dailyCapUSD: 20, perTxCapUSD: 5, note: "Research agent — small purchases only." },
  agt_broker: { dailyCapUSD: null, perTxCapUSD: null, note: "Inherits the global policy." },
  agt_sentinel: { dailyCapUSD: 5, perTxCapUSD: 1, note: "Monitoring agent — nearly read-only." },
};

/* ----------------------------- reputation ----------------------------- */

export const reputation: Reputation = {
  score: 742,
  tier: "Trusted",
  deltaWeek: 12,
  history: (() => {
    const points: { time: string; score: number }[] = [];
    let score = 641;
    for (let d = 90; d >= 0; d--) {
      score = Math.min(1_000, Math.max(0, score + (rng() - 0.34) * 3.4));
      points.push({ time: iso(d * DAY), score: Math.round(score) });
    }
    points[points.length - 1] = { time: iso(0), score: 742 };
    return points;
  })(),
  components: [
    {
      key: "reliability",
      label: "Payment reliability",
      score: 92,
      max: 100,
      explainer: "Share of initiated payments that settled without retries or reversals.",
    },
    {
      key: "compliance",
      label: "Policy compliance",
      score: 98,
      max: 100,
      explainer: "How consistently agents stayed inside their on-chain spending policy.",
    },
    {
      key: "volume",
      label: "Volume",
      score: 61,
      max: 100,
      explainer: "Settled payment volume relative to peers in the same tier.",
    },
    {
      key: "age",
      label: "Age",
      score: 44,
      max: 100,
      explainer: "Time since the identity registered on Stellar8004.",
    },
    {
      key: "endorsements",
      label: "Peer endorsements",
      score: 57,
      max: 100,
      explainer: "Attestations from counterparties that transacted with your agents.",
    },
  ],
  events: [
    { id: "re_1", time: iso(6 * HOUR), text: "Completed x402 payment to GDXN…KQ4T", delta: 2 },
    { id: "re_2", time: iso(1 * DAY), text: "Policy respected 100% this week", delta: 5 },
    { id: "re_3", time: iso(2 * DAY), text: "Peer endorsement from Nightowl Feeds", delta: 3 },
    { id: "re_4", time: iso(4 * DAY), text: "MPP session settled cleanly (312 ticks)", delta: 2 },
    { id: "re_5", time: iso(6 * DAY), text: "Payment retry detected on transfer", delta: -1 },
    { id: "re_6", time: iso(8 * DAY), text: "30 days of continuous uptime", delta: 4 },
  ],
};

/* ------------------------------ api keys ------------------------------ */

export const apiKeys: ApiKey[] = [
  {
    id: "key_1",
    name: "Atlas production",
    prefix: "nbl_live_9f2k",
    createdAt: iso(70 * DAY),
    lastUsed: iso(9 * 60_000),
    expiresAt: null,
    agentId: "agt_atlas",
  },
  {
    id: "key_2",
    name: "Scout desktop",
    prefix: "nbl_live_h7ma",
    createdAt: iso(50 * DAY),
    lastUsed: iso(2 * HOUR),
    expiresAt: null,
    agentId: "agt_scout",
  },
  {
    id: "key_3",
    name: "CI smoke tests",
    prefix: "nbl_test_p01x",
    createdAt: iso(15 * DAY),
    lastUsed: iso(3 * DAY),
    expiresAt: iso(-75 * DAY),
    agentId: null,
  },
];

/* -------------------------------- team -------------------------------- */

export const team: TeamMember[] = [
  {
    id: "mem_1",
    name: "Manav Goyal",
    email: "manucool123.rich@gmail.com",
    role: "Owner",
    joinedAt: iso(80 * DAY),
  },
  {
    id: "mem_2",
    name: "Ada Okafor",
    email: "ada@nebulalabs.dev",
    role: "Admin",
    joinedAt: iso(44 * DAY),
  },
  {
    id: "mem_3",
    name: "Jonas Weiss",
    email: "jonas@nebulalabs.dev",
    role: "Member",
    joinedAt: iso(19 * DAY),
  },
];

/* ------------------------------- billing ------------------------------ */

export const billing: BillingInfo = {
  plan: "Pro",
  renewsAt: iso(-17 * DAY),
  mcpCallsUsed: 41_205,
  mcpCallsLimit: 100_000,
  txVolumeUsedUSD: 1_284,
  txVolumeLimitUSD: 5_000,
  paymentMethod: { brand: "Visa", last4: "4842" },
};

export const invoices: Invoice[] = [
  { id: "inv_4", number: "NB-2026-0104", date: iso(9 * DAY), amountUSD: 49, status: "due" },
  { id: "inv_3", number: "NB-2026-0071", date: iso(39 * DAY), amountUSD: 49, status: "paid" },
  { id: "inv_2", number: "NB-2026-0043", date: iso(70 * DAY), amountUSD: 49, status: "paid" },
  { id: "inv_1", number: "NB-2025-0387", date: iso(100 * DAY), amountUSD: 49, status: "paid" },
];

export const notificationPrefs: NotificationPrefs = {
  policyViolations: true,
  lowBalance: true,
  yieldMilestones: false,
  weeklySummary: true,
};

export const webhooks: Webhook[] = [
  {
    id: "wh_1",
    url: "https://api.nebulalabs.dev/hooks/nebula",
    events: ["policy.violation", "tx.failed"],
    createdAt: iso(30 * DAY),
  },
];

export const notifications: AppNotification[] = [
  {
    id: "ntf_1",
    time: iso(26 * 60_000),
    title: "Yield milestone",
    body: "Your treasury crossed 400 XLM in lifetime yield.",
    read: false,
  },
  {
    id: "ntf_2",
    time: iso(5 * HOUR),
    title: "Policy nudge",
    body: "Atlas reached 61% of today's spending cap.",
    read: false,
  },
  {
    id: "ntf_3",
    time: iso(2 * DAY),
    title: "Blend rate change",
    body: "XLM Core APY moved from 6.51% to 6.84%.",
    read: true,
  },
];

export const workspace: Workspace = {
  name: "Nebula Labs",
  network: "testnet",
};
