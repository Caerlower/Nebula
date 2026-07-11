# Nebula MCP — Developer & testing guide

Internal reference for monorepo contributors. User-facing docs: [README](../packages/mcp-server/README.md), [TOOLS](../packages/mcp-server/TOOLS.md).

## Package versions

| Package | Version |
|---------|---------|
| `@trionlabs/stellar8004` | 0.0.11 |
| `@stellar/mpp` | 0.7.1 |
| `mppx` | 0.8.6 |
| `@x402/core` / `@x402/stellar` | ~2.17.0 |
| `@blend-capital/blend-sdk` | ^3.3.0 |
| `@stellar/stellar-sdk` | ^16.0.1 |
| `@modelcontextprotocol/sdk` | ^1.29.0 |

## Build & run

```bash
pnpm --filter nebula-mcp build
pnpm --filter nebula-mcp dev
pnpm --filter nebula-mcp build:mcpb
```

## Testing x402

1. Fund XLM (Friendbot), add Circle USDC trustline, [Circle faucet](https://faucet.circle.com/)
2. Set `MAX_PER_CALL` / `MAX_PER_DAY` high enough for micropayments

```bash
cd packages/mcp-server
PAY_TO=GYOUR_TESTNET_ADDRESS node scripts/dev/x402-test-server.mjs
```

> Use x402_fetch from Nebula with url http://localhost:3001/my-service

## Testing MPP

1. `mpp_open_session` with budget + recipient
2. Start channel server with printed contract + commitment pubkey
3. `mpp_fetch` against local URL
4. `mpp_close_session`

```bash
CHANNEL_CONTRACT=C... COMMITMENT_PUBKEY=<hex> MPP_RECIPIENT=G... \
  node scripts/dev/mpp-channel-test-server.mjs
```

## Testing Stellar8004

> Use register_identity from Nebula  
> Use get_my_reputation from Nebula

Testnet contracts (SDK defaults) — see Trion Labs / stellar8004.com docs.

## On-chain policy (testnet)

Example deployment: `CDAXOPVILENGGLPU3CNOOS53P255PUAVODI4EAJC6A4VIZQT3BAMVTXP`

Source: `contracts/policy/` · Bundled WASM: `packages/mcp-server/contracts/policy.wasm`

## Treasury

Background loop logs to stderr. Tools: `get_treasury_status`, `optimize_treasury`.
