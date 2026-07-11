#![no_std]

mod limits;

use limits::{
    compute_daily_spent, enforce_amount, get_state, record_spend, validate_limits, DataKey,
    PolicyState, Status, DAY_IN_LEDGERS,
};
use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

/// Nebula on-chain spending policy.
///
/// Deploy once per user. Limits live in persistent instance storage and are
/// updated cheaply via [`NebulaPolicyContract::set_limits`].
///
/// Future smart-account wiring: attach this contract as an OpenZeppelin-style
/// policy signer and route authorization contexts to [`enforce`].
#[contract]
pub struct NebulaPolicyContract;

#[contractimpl]
impl NebulaPolicyContract {
    /// One-time setup after deploy. Stores owner + limits.
    ///
    /// `max_per_call` and `max_per_day` are in stroops (same units as token
    /// `transfer` amounts the policy inspects).
    pub fn initialize(
        env: Env,
        owner: Address,
        max_per_call: i128,
        max_per_day: i128,
    ) {
        if env.storage().instance().has(&DataKey::State) {
            soroban_sdk::panic_with_error!(&env, limits::Error::AlreadyInitialized);
        }

        owner.require_auth();
        validate_limits(&env, max_per_call, max_per_day);

        let state = PolicyState {
            owner: owner.clone(),
            max_per_call,
            max_per_day,
            period_ledgers: DAY_IN_LEDGERS,
            spending_history: Vec::new(&env),
            cached_daily_spent: 0,
        };

        env.storage().instance().set(&DataKey::State, &state);
    }

    /// Owner-only limit update. Does not redeploy the contract.
    pub fn set_limits(env: Env, max_per_call: i128, max_per_day: i128) {
        let mut state = get_state(&env);
        state.owner.require_auth();
        validate_limits(&env, max_per_call, max_per_day);

        state.max_per_call = max_per_call;
        state.max_per_day = max_per_day;
        env.storage().instance().set(&DataKey::State, &state);
    }

    /// Read current limits and rolling-window spend.
    pub fn get_status(env: Env) -> Status {
        let state = get_state(&env);
        let current_ledger = env.ledger().sequence();
        let daily_spent = compute_daily_spent(&state, current_ledger);

        Status {
            owner: state.owner,
            max_per_call: state.max_per_call,
            max_per_day: state.max_per_day,
            daily_spent,
            daily_remaining: state.max_per_day.saturating_sub(daily_spent),
            period_ledgers: state.period_ledgers,
            history_len: state.spending_history.len(),
        }
    }

    /// Isolation-test helper: enforce limits and record spend on success.
    ///
    /// Requires owner authorization. Use this before the contract is attached to
    /// a smart account policy signer.
    pub fn check_spend(env: Env, amount: i128) {
        let mut state = get_state(&env);
        state.owner.require_auth();
        enforce_amount(&env, &mut state, amount);

        if amount > 0 {
            record_spend(&env, &mut state, amount);
            env.storage().instance().set(&DataKey::State, &state);
        }
    }

    // `enforce(Context, ...)` is intentionally omitted from the CLI-facing ABI.
    // Soroban SDK `auth::Context` is a host type whose full union spec is not
    // embedded in WASM, which breaks `stellar contract invoke` with
    // "Missing Entry Context" for every function on the contract.
    // Smart-account wiring will call the shared limit logic from an SDK client.
}

#[cfg(test)]
mod test;
