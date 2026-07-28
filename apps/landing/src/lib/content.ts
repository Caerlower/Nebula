/** Landing copy. Keep lines short and readable. */

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
    body: 'Caps, categories, and destinations live in a Soroban contract. Anything outside those rules never leaves the Hub.',
    stat: 'Soroban',
    statLabel: 'contract-enforced limits',
  },
  {
    n: '02',
    title: 'Automated treasury',
    body: 'Idle USDC earns in Blend above your liquid floor, then unwinds when a payment needs cash. You set the band.',
    stat: '~5s',
    statLabel: 'unwind to spendable',
  },
  {
    n: '03',
    title: 'Machine payments',
    body: 'Agents pay metered APIs and settle with each other over x402 and MPP. No cards, invoices, or humans in the loop.',
    stat: 'x402 · MPP',
    statLabel: 'two payment rails',
  },
  {
    n: '04',
    title: 'Keys stay in the Hub',
    body: 'Agents get a scoped credential, never a signing key. Pause or revoke one agent without touching the rest.',
    stat: 'Privy',
    statLabel: 'custody + rotation',
  },
]

export const STEPS = [
  {
    n: '01',
    title: 'Connect',
    body: 'Point any MCP client at one endpoint. No custom SDK glue.',
  },
  {
    n: '02',
    title: 'Set policy',
    body: 'Caps, categories, and a yield band. Signed on chain in one transaction.',
  },
  {
    n: '03',
    title: 'Spend',
    body: 'The agent pays inside its limits. Idle balance keeps earning.',
  },
  {
    n: '04',
    title: 'Review',
    body: 'Every call, payment, and rebalance is attributed and exportable.',
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
    note: 'Fast settlement. Fees in fractions of a cent.',
  },
  {
    role: 'Contracts',
    name: 'Soroban',
    note: 'Holds each agent policy and enforces it on every payment.',
  },
  {
    role: 'Money',
    name: 'Circle USDC',
    note: 'What agents hold and spend.',
  },
  {
    role: 'Yield',
    name: 'Blend',
    note: 'Where idle balances earn until needed.',
  },
  {
    role: 'Payments',
    name: 'x402 and MPP',
    note: 'Metered APIs and agent-to-agent settlement.',
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
    body: 'Caps and allowlists are contract state. A compromised prompt cannot raise them.',
  },
  {
    n: '02',
    title: 'Scoped agent credentials',
    body: 'Each agent has its own credential and wallet. Revoking one leaves the others alone.',
  },
  {
    n: '03',
    title: 'One-ledger pause',
    body: 'Pause stops every rail for an agent in a single ledger close. Funds stay put.',
  },
  {
    n: '04',
    title: 'Attributable ledger',
    body: 'Every tool call, payment, and rebalance is recorded against an agent for audit.',
  },
]

export const DOCS = [
  {
    title: 'MCP reference',
    body: 'Tools, argument shapes, and policy errors.',
  },
  {
    title: 'Policy contracts',
    body: 'Soroban sources for caps, categories, and destinations.',
  },
  {
    title: 'Treasury automation',
    body: 'Liquid floor, sweeps, and unwinds.',
  },
  {
    title: 'Payment rails',
    body: 'x402 metered requests and MPP settlement.',
  },
]
