/** Landing copy sourced from Nebula Landing v2 Design Canvas. */

export const TICKER = [
  'One MCP endpoint',
  'Soroban policy contracts',
  'Blend yield',
  'x402 metered requests',
  'MPP settlement',
  'Circle USDC',
  'Keys held by the Hub',
]

export const CAPS = [
  {
    n: '01',
    title: 'On-chain policy',
    body: 'Per-transaction and daily ceilings, category allowlists and destination rules live in a Soroban contract. A payment that breaks one never reaches the network.',
    stat: 'Soroban',
    statLabel: 'contract-enforced limits',
  },
  {
    n: '02',
    title: 'Automated treasury',
    body: 'Idle USDC sweeps into Blend above your liquid floor and unwinds the moment a payment needs it. Set a band, the Hub holds the balance inside it.',
    stat: '~5s',
    statLabel: 'unwind to spendable',
  },
  {
    n: '03',
    title: 'Machine payments',
    body: 'Agents pay per request against metered APIs and settle with other agents directly. No card, no invoice, no human in the loop.',
    stat: 'x402 · MPP',
    statLabel: 'two payment rails',
  },
  {
    n: '04',
    title: 'Keys stay in the Hub',
    body: 'The agent holds a scoped credential, never a signing key. Pause every rail within one ledger or revoke an agent outright without touching its code.',
    stat: 'Privy',
    statLabel: 'custody + rotation',
  },
]

export const STEPS = [
  {
    n: '01',
    title: 'Connect',
    body: 'Point the agent at one MCP endpoint. Any framework that speaks MCP works unchanged.',
  },
  {
    n: '02',
    title: 'Set policy',
    body: 'Caps, categories and a yield band, signed on chain in a single transaction.',
  },
  {
    n: '03',
    title: 'Spend',
    body: 'The agent transacts inside its limits and earns on everything it is not using.',
  },
  {
    n: '04',
    title: 'Review',
    body: 'Every call, payment and rebalance attributed to an agent and exportable.',
  },
]

export const COUNTERS = [
  {
    pre: '',
    to: 1,
    dec: 0,
    suf: '\u00a0MCP',
    label: 'Endpoint per agent fleet',
    sub: 'tools, not SDK glue',
  },
  {
    pre: '~',
    to: 5,
    dec: 0,
    suf: 's',
    label: 'Unwind from Blend to spendable',
    sub: 'automatic, mid-payment',
  },
  {
    pre: '',
    to: 100,
    dec: 0,
    suf: '%',
    label: 'Transactions checked against policy',
    sub: 'before they are signed',
  },
  {
    pre: '',
    to: 0,
    dec: 0,
    suf: '',
    label: 'Signing keys in agent context',
    sub: 'prompt, logs or memory',
  },
]

export const CHIPS = [
  'Stellar',
  'Soroban',
  'Blend pools',
  'Circle USDC',
  'x402',
  'MPP',
  'Privy',
]

export const STACK = [
  {
    role: 'Network',
    name: 'Stellar',
    note: 'Settlement in seconds, fees in fractions of a cent.',
  },
  {
    role: 'Contracts',
    name: 'Soroban',
    note: 'Holds each agent policy and enforces it on every payment.',
  },
  {
    role: 'Money',
    name: 'Circle USDC',
    note: 'What agents actually hold and spend.',
  },
  {
    role: 'Yield',
    name: 'Blend',
    note: 'Where idle balances earn until they are needed.',
  },
  {
    role: 'Payments',
    name: 'x402 and MPP',
    note: 'Metered API calls and agent-to-agent settlement.',
  },
  {
    role: 'Custody',
    name: 'Privy',
    note: 'Keys live in the Hub and rotate without downtime.',
  },
]

export const SECURITY = [
  {
    n: '01',
    title: 'Limits enforced by contract',
    body: 'Caps and allowlists are contract state. Nothing in the agent runtime can raise them, including a compromised prompt.',
  },
  {
    n: '02',
    title: 'Scoped agent credentials',
    body: 'Each agent gets its own credential and wallet. Revoking one leaves every other agent untouched.',
  },
  {
    n: '03',
    title: 'One-ledger pause',
    body: 'Pause stops every rail for an agent inside a single ledger close. Funds stay put; nothing is lost.',
  },
  {
    n: '04',
    title: 'Attributable ledger',
    body: 'Every tool call, payment and rebalance is recorded against an agent and exportable for audit.',
  },
]

export const DOCS = [
  {
    title: 'MCP reference',
    body: 'Every tool the agent can call, with argument shapes and policy errors.',
  },
  {
    title: 'Policy contracts',
    body: 'Soroban sources for caps, categories and destination rules.',
  },
  {
    title: 'Treasury automation',
    body: 'How the liquid floor, sweeps and unwinds are computed.',
  },
  {
    title: 'Payment rails',
    body: 'Wiring x402 metered requests and MPP agent-to-agent settlement.',
  },
]
