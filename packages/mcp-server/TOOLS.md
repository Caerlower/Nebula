# Nebula MCP — Tool Reference

**23 tools** across wallet, payments, treasury, on-chain policy, and agent identity.

Default network: **testnet**. Spending limits apply to agent outgoing payments (transfers, x402, MPP) — not treasury rebalancing.

---

## Wallet & dashboard

| Tool | Parameters | What it does |
|------|------------|--------------|
| `ping` | — | Health check — confirms the server is running. |
| `help` | `category?` | Full feature guide: all tools by category, env vars, quick-start prompts, and your current config. Categories: `wallet`, `transfers`, `limits`, `policy`, `x402`, `mpp`, `treasury`, `identity`. |
| `get_address` | — | Returns the wallet public key (`G...`). |
| `check_balance` | — | XLM and USDC balances on the configured network. |
| `wallet_dashboard` | — | **Interactive in-chat UI** (MCP Apps): balances, limits, treasury, MPP session, 8004 identity. |
| `request_funding` | — | Friendbot link (testnet) or funding instructions (mainnet). |

**Try in chat:** *"Use wallet_dashboard from Nebula"* or *"Use check_balance from Nebula"*

---

## Transfers

| Tool | Parameters | What it does |
|------|------------|--------------|
| `transfer_xlm` | `destination` (G...), `amount` | Send XLM. Subject to spending limits. |
| `transfer_usdc` | `destination` (G...), `amount` | Send USDC (requires trustline). Subject to spending limits. |

---

## Spending limits

| Tool | Parameters | What it does |
|------|------------|--------------|
| `spending_report` | — | Per-call cap, daily cap, spent in rolling 24h, remaining budget. Reads on-chain policy when `POLICY_CONTRACT_ID` is set. |

Limits are enforced **before** any spend signs. Treasury moves are exempt.

---

## On-chain policy (Soroban)

| Tool | Parameters | What it does |
|------|------------|--------------|
| `deploy_policy` | `max_per_call?`, `max_per_day?` | Deploy + initialize a new `nebula-policy` contract. Returns `POLICY_CONTRACT_ID` to add to your MCP env. |
| `get_policy_status` | — | Read on-chain limits and rolling-window usage. Requires `POLICY_CONTRACT_ID`. |
| `set_policy_limits` | `max_per_call`, `max_per_day` | Owner updates caps on-chain (no redeploy). |

When `POLICY_CONTRACT_ID` is set, off-chain `MAX_PER_CALL` / `MAX_PER_DAY` are ignored for enforcement.

---

## x402 payments (per-request)

| Tool | Parameters | What it does |
|------|------------|--------------|
| `x402_fetch` | `url` | GET a URL. On HTTP 402, pays USDC via x402 and retries automatically. Subject to spending limits. |

**Flow:** request → 402 + payment terms → sign USDC → retry with payment header → response.

---

## MPP sessions (streaming / high-frequency)

Open one session, pay many times off-chain, settle once on-chain.

| Tool | Parameters | What it does |
|------|------------|--------------|
| `mpp_open_session` | `budget` (USDC), `recipient?` (G...) | Deploy channel contract, deposit budget on-chain. `recipient` defaults to `MPP_RECIPIENT` env. |
| `mpp_status` | — | Active session: channel address, budget, committed spend, remaining. |
| `mpp_fetch` | `url` | Pay an MPP-gated URL with off-chain commitments (no per-hit on-chain tx). |
| `mpp_close_session` | — | On-chain settle — pay recipient, refund unused deposit. |

**Typical flow:** `mpp_open_session` → `mpp_fetch` (repeat) → `mpp_close_session`

---

## Treasury & yield (Blend)

Background rebalancer runs automatically (`REBALANCE_INTERVAL_SECONDS`, default 60s).

| Tool | Parameters | What it does |
|------|------------|--------------|
| `get_treasury_status` | — | Liquid vs Blend balances, APY, threshold, last rebalance. |
| `set_liquidity_threshold` | `threshold` | Minimum liquid balance; excess auto-deposits to Blend. |
| `optimize_treasury` | — | Trigger one rebalance immediately. |
| `blend_check_rates` | — | Read-only Blend supply APY on testnet. |

Configure with `TREASURY_ASSET` (`xlm` or `usdc`), `LIQUIDITY_THRESHOLD`, `XLM_FEE_BUFFER`.

---

## Agent identity (Stellar8004)

| Tool | Parameters | What it does |
|------|------------|--------------|
| `register_identity` | — | Mint ERC-8004 agent NFT for this wallet. Idempotent if already registered. |
| `get_my_reputation` | — | This agent's feedback count, average score, unique clients. |

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `STELLAR_SECRET_KEY` | **Yes** | — | Wallet secret key (`S...`) |
| `NETWORK` | No | `testnet` | `testnet` or `mainnet` |
| `MAX_PER_CALL` | Off-chain mode | — | Cap per transfer / x402 / MPP open |
| `MAX_PER_DAY` | Off-chain mode | — | Rolling 24h cap |
| `POLICY_CONTRACT_ID` | No | — | On-chain Soroban policy (`C...`) |
| `TREASURY_ASSET` | No | `xlm` | `xlm` or `usdc` for Blend treasury |
| `LIQUIDITY_THRESHOLD` | No | `10` | Min liquid before depositing to Blend |
| `REBALANCE_INTERVAL_SECONDS` | No | `60` | Background treasury loop interval |
| `XLM_FEE_BUFFER` | No | `5` | XLM reserved for fees when treasury asset is XLM |
| `MPP_RECIPIENT` | MPP | — | Default G... for channel payouts |
| `TREASURY_MAX_PER_REBALANCE` | No | — | Optional cap per treasury move |
| `POLICY_WASM_PATH` | No | bundled | Override policy WASM path |
| `MPP_CHANNEL_WASM_PATH` | No | bundled | Override MPP channel WASM path |

Optional 8004 metadata: `AGENT8004_NAME`, `AGENT8004_DESCRIPTION`, `AGENT8004_IMAGE_URL`

---

## What counts against spending limits

| Action | Limited? |
|--------|----------|
| `transfer_xlm` / `transfer_usdc` | Yes |
| `x402_fetch` | Yes |
| `mpp_open_session` (budget) | Yes |
| `mpp_fetch` (cumulative commitments) | Session budget |
| Treasury rebalance | **No** |
| `blend_check_rates`, `get_treasury_status` | **No** (read-only) |
| `register_identity`, `get_my_reputation` | **No** |

---

## Networks

| | Testnet | Mainnet |
|---|---------|---------|
| Default | ✓ | Set `NETWORK=mainnet` |
| Friendbot | ✓ | — |
| USDC issuer | Circle testnet SAC | Circle mainnet |
| Blend treasury | Testnet pools | Verify pool availability |
| Stellar8004 | Testnet contracts | Mainnet contracts |

Start on testnet: fund XLM via `request_funding`, add USDC trustline, use [Circle faucet](https://faucet.circle.com/) for test USDC.

---

## Quick start prompts

```
Use help from Nebula
Use ping from Nebula
Use get_address from Nebula
Use request_funding from Nebula
Use wallet_dashboard from Nebula
Use spending_report from Nebula
Use x402_fetch from Nebula with url https://...
```

---

## Bundled contracts (no CLI build required)

| WASM | Purpose |
|------|---------|
| `policy.wasm` | On-chain spending policy |
| `channel.wasm` | MPP one-way payment channel |

Both ship inside the npm package under `dist/contracts/`.
