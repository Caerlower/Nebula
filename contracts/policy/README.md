# Nebula spending policy (Soroban)

On-chain per-call and rolling daily spend limits for a single owner wallet.

Deploy **once** per user. Update limits with `set_limits` (no redeploy).

## Research baseline (current Stellar stack)

| Item | Version / pattern |
|------|-------------------|
| **Soroban SDK** | `26.1.0` (matches OpenZeppelin `stellar-contracts` 0.7.1) |
| **Stellar CLI** | `23.0.0` (`stellar contract build/deploy/invoke`) |
| **Rust toolchain** | `1.92.0` + `wasm32v1-none` (see `rust-toolchain.toml`) |
| **Policy interface** | OpenZeppelin [`Policy`](https://docs.openzeppelin.com/stellar-contracts/accounts/policies) trait: `install`, `enforce`, `uninstall` |
| **Auth model** | Smart accounts implement `CustomAccountInterface::__check_auth`; policies attach to **context rules** and panic to reject |
| **Passkey Kit** | Legacy; new work uses [OpenZeppelin Smart Account Kit](https://github.com/kalepail/smart-account-kit) |

This contract is a **single-tenant policy** (one deploy per user) with an `enforce` entrypoint shaped for future smart-account attachment. For isolated testing, use `check_spend`.

Amounts are **stroops** (same integer units as token `transfer` amounts).

Rolling window: **17,280 ledgers** (~24h at 5s/ledger), same convention as OpenZeppelin spending-limit policy.

## Build

```bash
cd contracts/policy
stellar contract build --package nebula-policy
```

WASM output: `target/wasm32v1-none/release/nebula_policy.wasm`

## Deploy to testnet (once)

Replace `OWNER` with your funded testnet `G...` address and `SOURCE` with the secret-key identity name in stellar CLI.

```bash
cd contracts/policy

# If needed: stellar keys add nebula --secret-key S...
# Fund: stellar keys fund nebula --network testnet

stellar contract deploy \
  --wasm target/wasm32v1-none/release/nebula_policy.wasm \
  --source nebula \
  --network testnet \
  --alias nebula-policy
```

Save the returned `C...` contract id.

## Initialize (sets owner + initial limits)

Example: max 1 XLM per call, 5 XLM per day (in stroops):

```bash
POLICY_ID=C...   # from deploy
OWNER=G...       # same as deploy source account

stellar contract invoke \
  --id "$POLICY_ID" \
  --source nebula \
  --network testnet \
  --send yes \
  -- \
  initialize \
  --owner "$OWNER" \
  --max_per_call 10000000 \
  --max_per_day 50000000
```

## Read status

```bash
stellar contract invoke \
  --id "$POLICY_ID" \
  --source nebula \
  --network testnet \
  -- \
  get_status
```

## Test: spend under limit (succeeds)

```bash
# 0.5 XLM — under per-call (1) and daily (5)
stellar contract invoke \
  --id "$POLICY_ID" \
  --source nebula \
  --network testnet \
  --send yes \
  -- \
  check_spend \
  --amount 5000000
```

Re-run `get_status` — `daily_spent` should increase.

## Test: over per-call limit (rejected on-chain)

```bash
# 1.5 XLM — exceeds max_per_call 1 XLM
stellar contract invoke \
  --id "$POLICY_ID" \
  --source nebula \
  --network testnet \
  --send yes \
  -- \
  check_spend \
  --amount 15000000
```

Expected: transaction fails with contract error **#5** (`PerCallLimitExceeded`).

## Update limits without redeploy

Raise per-call cap to 2 XLM, keep daily at 5 XLM:

```bash
stellar contract invoke \
  --id "$POLICY_ID" \
  --source nebula \
  --network testnet \
  --send yes \
  -- \
  set_limits \
  --max_per_call 20000000 \
  --max_per_day 50000000
```

## Confirm new limits take effect

```bash
# Now 1.5 XLM should succeed (was rejected before)
stellar contract invoke \
  --id "$POLICY_ID" \
  --source nebula \
  --network testnet \
  --send yes \
  -- \
  check_spend \
  --amount 15000000

stellar contract invoke \
  --id "$POLICY_ID" \
  --source nebula \
  --network testnet \
  -- \
  get_status
```

Same `POLICY_ID` throughout — no second deploy.

> **Auth-required calls** (`initialize`, `check_spend`, `set_limits`) need `--send yes` so the CLI attaches Soroban auth entries for `owner.require_auth()`.

### One-shot testnet script

```bash
contracts/policy/scripts/testnet-deploy-and-test.sh
```

Reads `STELLAR_SECRET_KEY` from `packages/mcp-server/.env`, deploys, runs the full pass/fail/update flow.

### Already deployed (testnet)

| Field | Value |
|-------|-------|
| Contract | `CCDTZVYQXQPO33K76BXICTVHA4NWI3CKTGHT57W2YHKJODDMKJVZJ4AH` |
| WASM hash | `b9ada4ab98a7b3e840377c90c582ba12596583da43c80a7e46ad792b5693ebb2` |
| Deploy tx | [stellar.expert/testnet/tx/d2c4ef16…](https://stellar.expert/explorer/testnet/tx/d2c4ef167e0c8607748323506fffbd79faa9617ba0fb575f4f1f0fbe7da7a725) |

Run `initialize` with `--send yes` on this id if you want to reuse it instead of redeploying.

## Contract API

| Function | Auth | Description |
|----------|------|-------------|
| `initialize(owner, max_per_call, max_per_day)` | owner | One-time setup after deploy |
| `set_limits(max_per_call, max_per_day)` | owner | Cheap limit update |
| `get_status()` | — | Limits + rolling daily usage |
| `check_spend(amount)` | owner | Isolation test: enforce + record |
| `enforce(context, smart_account)` | smart_account | Policy-signer path for token `transfer` contexts |

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

## Future MCP wiring (not this stage)

Attach this contract to an OpenZeppelin smart account context rule as a policy signer. `enforce` will inspect `transfer` auth contexts and update rolling spend automatically during wallet authorization.
