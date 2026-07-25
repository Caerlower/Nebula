# Nebula spending + treasury policy (Soroban)

Shared multi-tenant contract: **one deploy for all users**. Each agent `G…` address owns a policy slot (`DataKey::Policy(owner)`) and signs initialize / set_* / pause / `check_spend`.

Policy mutations are **dashboard-gated in Hub** (no MCP tools). The agent key is the funded custodial signer so fee XLM lives on the same wallet that spends.

Enforces / stores:

- Global `max_per_call` + `max_per_day` (**USDC** stroops)
- Per-category daily caps for **outbound** spend: **Transfer / X402 / MPP** (**USDC** stroops)
- Fixed **24 hourly spend buckets** (rolling ~24h window; constant-size state)
- On-chain **pause** (`set_paused`) — blocks `check_spend` only; resume still works via the same agent wallet
- **Treasury band**: `liquid_low` / `liquid_high` (**USDC** stroops) + `auto_yield` (published for Hub; not enforced on-chain)

Same 7-decimal scaler (`10_000_000`) throughout. Hub converts XLM↔USDC via oracle for transfers and for comparing the liquid band against native Blend balances.

Hub wires this when a network-specific contract id is set (`POLICY_CONTRACT_ID_TESTNET` / `POLICY_CONTRACT_ID_MAINNET`): Policy PATCH → `set_*` / pause; transfers → `check_spend`. If the id for a ledger is unset, Hub keeps off-chain caps only for that ledger.

## Table of contents

- [Build](#build)
- [Deploy to testnet (once)](#deploy-to-testnet-once)
- [Deploy to mainnet (once)](#deploy-to-mainnet-once)
- [Initialize a user slot](#initialize-a-user-slot)
- [Contract API](#contract-api)
- [Errors](#errors)

## Build

```bash
cd contracts/policy
stellar contract build --package nebula-policy
```

WASM: `target/wasm32v1-none/release/nebula_policy.wasm`

> Unit tests (`cargo test`) may fail in this workspace due to an `ed25519-dalek` / `rand_core` mismatch in Soroban testutils. Release/wasm builds are fine.

## Deploy to testnet (once)

```bash
cd contracts/policy
stellar contract deploy \
  --wasm target/wasm32v1-none/release/nebula_policy.wasm \
  --source nebula \
  --network testnet \
  --alias nebula-policy
```

Put the returned `C…` id in Hub:

```bash
# apps/nebula-hub/.env.local
POLICY_CONTRACT_ID_TESTNET=C…
# or legacy:
# POLICY_CONTRACT_ID=C…
```

**Fresh deploy required** after the hourly-bucket `PolicyState` change. Old slots will not deserialize — re-initialize every agent against the new contract id.

### Deployed (testnet)

| Field | Value |
|-------|-------|
| Contract | `CAWKC7IEHVKM5V5JVXJE4HNWCM5CHZZHFYH33W5O7EEEQIND6TJ3CD2F` |
| WASM hash | `67ecf7d6f9d349dbdef9c3fe57ecf8bdeffc6a5dc67ff7b64874302441037817` |
| SDK | soroban-sdk 27.0.2 (protocol 27) |
| Deploy tx | [stellar.expert](https://stellar.expert/explorer/testnet/tx/13acb98b646c68368d7b8d26403bb2ee422a27fc6f15a0131ddc1512775954e4) |

Previous ids `CA334…` / `CA723…` are **obsolete**.

Hub:

```bash
# apps/nebula-hub/.env.local
POLICY_CONTRACT_ID_TESTNET=CAWKC7IEHVKM5V5JVXJE4HNWCM5CHZZHFYH33W5O7EEEQIND6TJ3CD2F
```

## Deploy to mainnet (once)

### Deployed (mainnet)

| Field | Value |
|-------|-------|
| Contract | `CCPXPACO3V2FISPN5CY5LGFSU7XI5QBVMHOC25ITJVTCIF2P3OCNILWU` |
| WASM hash | `67ecf7d6f9d349dbdef9c3fe57ecf8bdeffc6a5dc67ff7b64874302441037817` |
| Deploy tx | [stellar.expert](https://stellar.expert/explorer/public/tx/8df53b5a55f7b7fba59adc9746e728d77da892c21d8e429855068ec6718728c1) |
| Lab | [contract](https://lab.stellar.org/r/mainnet/contract/CCPXPACO3V2FISPN5CY5LGFSU7XI5QBVMHOC25ITJVTCIF2P3OCNILWU) |

Hub:

```bash
# apps/nebula-hub/.env.local
POLICY_CONTRACT_ID_MAINNET=CCPXPACO3V2FISPN5CY5LGFSU7XI5QBVMHOC25ITJVTCIF2P3OCNILWU
```

Create a mainnet agent (NetworkChip → MAINNET → Fleet) and save Policy once — Hub will `initialize` that agent’s slot via `ensurePolicyInitialized`.

Do **not** point mainnet at the testnet `CAWKC7…` id.

### Redeploy / ops notes

When ready (funded deployer key on pubnet):

```bash
cd contracts/policy
stellar contract build --package nebula-policy

# Prefer a dedicated network entry with a real RPC (CLI built-in `mainnet` has no RPC):
#   stellar network add mainnet-rpc \
#     --rpc-url https://mainnet.sorobanrpc.com \
#     --network-passphrase "Public Global Stellar Network ; September 2015"

stellar contract deploy \
  --wasm target/wasm32v1-none/release/nebula_policy.wasm \
  --source <funded-mainnet-identity> \
  --network mainnet-rpc \
  --alias nebula-policy-pubnet \
  --inclusion-fee 100000
```

If upload succeeds but create fails with `Wasm does not exist`, wait a moment and deploy by hash (alias must not collide with an identity name):

```bash
stellar contract deploy \
  --wasm-hash 67ecf7d6f9d349dbdef9c3fe57ecf8bdeffc6a5dc67ff7b64874302441037817 \
  --source <funded-mainnet-identity> \
  --network mainnet-rpc \
  --alias nebula-policy-pubnet \
  --inclusion-fee 100000
```

## Initialize a user slot

Hub calls this automatically on first Policy save or spend. Manual:

```bash
POLICY_ID=C…
OWNER=G…   # agent custody address

# Spend + band: USDC stroops (example: $5 / $20 daily, band $2–$10)
stellar contract invoke \
  --id "$POLICY_ID" \
  --source "$OWNER" \
  --network testnet \
  --send yes \
  -- \
  initialize \
  --owner "$OWNER" \
  --max_per_call 50000000 \
  --max_per_day 200000000 \
  --category_daily '{"transfer":200000000,"x402":50000000,"mpp":50000000}' \
  --liquid_low 20000000 \
  --liquid_high 100000000 \
  --auto_yield true
```

Amounts use **USDC stroops** (`1 USDC = 10_000_000`), including the liquid band.
Zero in a category means **block that category** (not a default sentinel).

## Contract API

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(owner, …)` | owner | One-time slot setup |
| `set_limits(owner, max_per_call, max_per_day)` | owner | Global USDC caps |
| `set_category_limits(owner, category_daily)` | owner | Per-category daily USDC caps |
| `set_treasury_band(owner, liquid_low, liquid_high, auto_yield)` | owner | Liquid USDC band + auto-yield |
| `set_paused(owner, paused)` | owner | Emergency pause / unpause (`check_spend` only) |
| `get_status(owner)` | — | Limits, band, pause, rolling usage |
| `check_spend(owner, category, amount)` | owner | Enforce + record USDC spend |

## Errors

| Code | Name |
|------|------|
| 1 | NotInitialized |
| 2 | AlreadyInitialized |
| 3 | Unauthorized |
| 4 | InvalidLimit |
| 5 | PerCallLimitExceeded |
| 6 | DailyLimitExceeded |
| 7 | NegativeAmount |
| 8 | NotAllowed |
| 9 | HistoryCapacityExceeded *(legacy; unused after hourly buckets)* |
| 10 | CategoryDailyLimitExceeded |
| 11 | InvalidTreasuryBand |
| 12 | InvalidRoles *(legacy; unused)* |
| 13 | Paused |
