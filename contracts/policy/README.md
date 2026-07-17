# Nebula spending + treasury policy (Soroban)

Shared multi-tenant contract: **one deploy for all users**. Each Stellar `G…` address owns a policy slot (`DataKey::Policy(owner)`).

Enforces / stores:

- Global `max_per_call` + `max_per_day` (**USDC** stroops)
- Per-category daily caps for **outbound** spend: **Transfer / X402 / MPP** (**USDC** stroops)
- **Treasury band**: `liquid_low` / `liquid_high` (**USDC** stroops) + `auto_yield`

Same 7-decimal scaler (`10_000_000`) throughout. Hub converts XLM↔USDC via CoinGecko for transfers and for comparing the liquid band against native Blend balances.

Blend deposits themselves are not a spend category — the band tells Hub when to park/pull.

Hub wires this when `POLICY_CONTRACT_ID` is set: Policy/Treasury PATCH → `set_limits` / `set_category_limits` / `set_treasury_band`; transfers → `check_spend`.

## Table of contents

- [Build](#build)
- [Deploy to testnet (once)](#deploy-to-testnet-once)
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

# stellar keys add nebula --secret-key S…
# stellar keys fund nebula --network testnet

stellar contract deploy \
  --wasm target/wasm32v1-none/release/nebula_policy.wasm \
  --source nebula \
  --network testnet \
  --alias nebula-policy
```

Put the returned `C…` id in Hub:

```bash
# apps/nebula-hub/.env.local
POLICY_CONTRACT_ID=C…
```

Do **not** reuse older single-tenant contract ids — the ABI changed (owner arg + categories).

### Deployed (testnet)

| Field | Value |
|-------|-------|
| Contract | `CA723RL3FJW42NSB6TGBWX4BOYQ3PMPXEHG447RUVX6K2LGHRXJ63EAM` |
| WASM hash | `e9b020adff61947962eb34df073fba959c5bd1918dafba03bcf4fc1da28f00ac` |
| Deploy tx | [stellar.expert](https://stellar.expert/explorer/testnet/tx/f11158f30cbdac3d1470e78ba5132d0f91b0b4975eb40d73365b1af114e86a58) |

Redeploy required after treasury-band ABI change — previous contract IDs are obsolete.

**USDC spend semantics** are a Hub convention on the existing ABI (no redeploy required for the unit change). Re-save Policy limits in Hub after switching so on-chain caps match USDC values.

## Initialize a user slot

Hub calls this automatically on first Policy/Treasury save or spend. Manual:

```bash
POLICY_ID=C…
OWNER=G…   # user's custody address

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
## Contract API

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(..., category_daily, liquid_low, liquid_high, auto_yield)` | owner | One-time slot setup |
| `set_limits(owner, max_per_call, max_per_day)` | owner | Global USDC caps |
| `set_category_limits(owner, category_daily)` | owner | Per-category daily USDC caps |
| `set_treasury_band(owner, liquid_low, liquid_high, auto_yield)` | owner | Liquid USDC band + auto-yield |
| `get_status(owner)` | — | Limits, band, rolling usage |
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
| 9 | HistoryCapacityExceeded |
| 10 | CategoryDailyLimitExceeded |
| 11 | InvalidTreasuryBand |

Rolling window: **17,280 ledgers** (~24h at 5s/ledger).
