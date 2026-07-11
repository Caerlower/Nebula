#!/usr/bin/env bash
# Deploy + test Nebula policy on testnet (reads STELLAR_SECRET_KEY from MCP .env).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENV_FILE="$ROOT/packages/mcp-server/.env"
POLICY_DIR="$ROOT/contracts/policy"
WASM="$POLICY_DIR/target/wasm32v1-none/release/nebula_policy.wasm"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="$(echo "$line" | xargs)"
  [[ -z "$line" ]] && continue
  if [[ "$line" == STELLAR_SECRET_KEY=* ]]; then
    export STELLAR_SECRET_KEY="${line#STELLAR_SECRET_KEY=}"
  fi
done < "$ENV_FILE"

if [[ -z "${STELLAR_SECRET_KEY:-}" ]]; then
  echo "STELLAR_SECRET_KEY not set in $ENV_FILE" >&2
  exit 1
fi

cd "$POLICY_DIR"
CARGO_TARGET_DIR=target stellar contract build --package nebula-policy >/dev/null

SOURCE_KEY="$STELLAR_SECRET_KEY"
NETWORK=testnet

echo "Deploying nebula-policy to $NETWORK..."
DEPLOY_OUT=$(stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$SOURCE_KEY" \
  --network "$NETWORK")

POLICY_ID=$(echo "$DEPLOY_OUT" | tail -1)
echo "POLICY_ID=$POLICY_ID"

OWNER=$(stellar keys address "$SOURCE_KEY" 2>/dev/null || true)
if [[ -z "$OWNER" ]]; then
  # stellar keys address may not work with raw secret; derive via node
  OWNER=$(node -e "const {Keypair}=require('@stellar/stellar-sdk'); console.log(Keypair.fromSecret(process.env.STELLAR_SECRET_KEY).publicKey())")
fi
echo "OWNER=$OWNER"

echo "Initializing limits: per-call=10_000_000, daily=50_000_000 stroops"
stellar contract invoke \
  --id "$POLICY_ID" \
  --source-account "$SOURCE_KEY" \
  --network "$NETWORK" \
  --send yes \
  -- \
  initialize \
  --owner "$OWNER" \
  --max_per_call 10000000 \
  --max_per_day 50000000

echo "Status after init:"
stellar contract invoke --id "$POLICY_ID" --source-account "$SOURCE_KEY" --network "$NETWORK" -- get_status

echo "check_spend 5_000_000 (ok)"
stellar contract invoke --id "$POLICY_ID" --source-account "$SOURCE_KEY" --network "$NETWORK" --send yes -- check_spend --amount 5000000

echo "check_spend 15_000_000 (should fail per-call)"
if stellar contract invoke --id "$POLICY_ID" --source-account "$SOURCE_KEY" --network "$NETWORK" --send yes -- check_spend --amount 15000000; then
  echo "ERROR: expected per-call rejection" >&2
  exit 1
else
  echo "Rejected as expected"
fi

echo "set_limits per-call=20_000_000"
stellar contract invoke --id "$POLICY_ID" --source-account "$SOURCE_KEY" --network "$NETWORK" --send yes -- set_limits --max_per_call 20000000 --max_per_day 50000000

echo "check_spend 15_000_000 after limit raise (ok)"
stellar contract invoke --id "$POLICY_ID" --source-account "$SOURCE_KEY" --network "$NETWORK" --send yes -- check_spend --amount 15000000

echo "Final status:"
stellar contract invoke --id "$POLICY_ID" --source-account "$SOURCE_KEY" --network "$NETWORK" -- get_status

echo "Done. POLICY_ID=$POLICY_ID"
