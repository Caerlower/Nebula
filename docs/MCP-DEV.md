# Nebula MCP — Developer & testing guide

Internal reference for monorepo contributors.

**Stack:** Hub (`apps/nebula-hub`) + `nebulamcp` (`packages/nebulamcp`) + `nebulamcp-core`.

## Package versions

| Package | Version |
|---------|---------|
| `nebulamcp-core` / `nebulamcp` | 0.1.0 |
| `@trionlabs/stellar8004` | 0.0.11 |
| `@stellar/mpp` | 0.7.1 |
| `mppx` | 0.8.6 |
| `@x402/core` / `@x402/stellar` | ~2.17.0 |
| `@blend-capital/blend-sdk` | ^3.3.0 |
| `@stellar/stellar-sdk` | ^16.0.1 |
| `@modelcontextprotocol/sdk` | ^1.29.0 |

## Build & run

```bash
pnpm --filter nebulamcp-core build
pnpm --filter nebulamcp build
pnpm --filter nebula-hub dev

# Claude Desktop / Cursor env:
# NEBULA_TOKEN=nbl_live_…
# NEBULA_HUB=http://localhost:3000
```

## Testing swaps (XLM ↔ USDC)

1. Fund XLM; open Circle USDC trustline on Connect if swapping into USDC
2. MCP: `get_swap_quote` with `from_asset` / `to_asset` / `amount`
3. MCP: `swap` with the same fields (optional `max_slippage_bps`, default 100 = 1%)
4. Large notional (> per-tx USDC cap) may require Hub approval + `await_confirmation`

Swaps use the Stellar DEX (path payment strict-send). They do **not** count toward daily outbound spend caps.

## Testing x402

1. Fund XLM (Friendbot), open Circle USDC trustline on Connect, [Circle faucet](https://faucet.circle.com/)
2. Set Hub Policy USDC caps high enough for micropayments
3. From MCP: `x402_fetch` with `url` (optional `max_amount_usdc`)

## Testing MPP

1. `mpp_open_session` with budget + recipient (Hub returns `demo_url`)
2. `mpp_fetch` against that URL
3. `mpp_close_session` when done

## Confirmations

After `confirmation_required`, open `/approve/:id` then call `await_confirmation`.

That tool only waits up to **25 seconds** per call (so Hub doesn't hang on serverless). If the human hasn't approved yet, it returns “still pending — call again” and the agent should re-call with the same `confirmation_id` until approved/rejected/expired.
