#![no_std]

mod limits;

use limits::{
    build_status, default_category_limits, enforce_amount, get_state, has_policy, record_spend,
    set_state, validate_category_limits, validate_limits, validate_treasury_band, CategoryLimits,
    DAY_IN_LEDGERS, SpendCategory, Status,
};
use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

/// Nebula on-chain spending + treasury policy (multi-tenant).
///
/// Hub deploys **one** shared instance. Each user's Stellar address owns a
/// policy slot: outbound spend caps (Transfer / X402 / MPP) plus the liquid
/// band that drives Blend auto-yield.
///
/// Units (same 7-decimal stroop scaler):
/// - `max_per_call` / `max_per_day` / category caps / `check_spend` → **USDC**
/// - `liquid_low` / `liquid_high` → **USDC** (Hub converts to XLM via CoinGecko
///   when comparing against native Blend balances)
/// Hub converts XLM transfers to USDC via CoinGecko before `check_spend`.
#[contract]
pub struct NebulaPolicyContract;

#[contractimpl]
impl NebulaPolicyContract {
    /// One-time setup for `owner`.
    ///
    /// All amount fields are **USDC** stroops (1 USDC = 10_000_000), including
    /// the liquid band. Hub converts the band to XLM when rebalancing Blend.
    ///
    /// If `category_daily` fields are all zero, each category defaults to
    /// `max_per_day`. Treasury band defaults: low=$2, high=$10, auto_yield=true
    /// when `liquid_low` and `liquid_high` are both zero.
    pub fn initialize(
        env: Env,
        owner: Address,
        max_per_call: i128,
        max_per_day: i128,
        category_daily: CategoryLimits,
        liquid_low: i128,
        liquid_high: i128,
        auto_yield: bool,
    ) {
        if has_policy(&env, &owner) {
            soroban_sdk::panic_with_error!(&env, limits::Error::AlreadyInitialized);
        }

        owner.require_auth();
        validate_limits(&env, max_per_call, max_per_day);

        let cats = if category_daily.transfer == 0
            && category_daily.x402 == 0
            && category_daily.mpp == 0
        {
            default_category_limits(max_per_day)
        } else {
            validate_category_limits(&env, &category_daily);
            category_daily
        };

        let (low, high) = if liquid_low == 0 && liquid_high == 0 {
            (20_000_000, 100_000_000) // $2 / $10 USDC
        } else {
            validate_treasury_band(&env, liquid_low, liquid_high);
            (liquid_low, liquid_high)
        };

        let state = limits::PolicyState {
            owner: owner.clone(),
            max_per_call,
            max_per_day,
            category_daily: cats,
            liquid_low: low,
            liquid_high: high,
            auto_yield,
            period_ledgers: DAY_IN_LEDGERS,
            spending_history: Vec::new(&env),
            cached_daily_spent: 0,
        };

        set_state(&env, &state);
    }

    /// Owner-only global spend limit update (USDC stroops).
    pub fn set_limits(env: Env, owner: Address, max_per_call: i128, max_per_day: i128) {
        owner.require_auth();
        let mut state = get_state(&env, &owner);
        if state.owner != owner {
            soroban_sdk::panic_with_error!(&env, limits::Error::Unauthorized);
        }
        validate_limits(&env, max_per_call, max_per_day);

        state.max_per_call = max_per_call;
        state.max_per_day = max_per_day;
        set_state(&env, &state);
    }

    /// Owner-only per-category daily caps (USDC stroops).
    pub fn set_category_limits(env: Env, owner: Address, category_daily: CategoryLimits) {
        owner.require_auth();
        let mut state = get_state(&env, &owner);
        if state.owner != owner {
            soroban_sdk::panic_with_error!(&env, limits::Error::Unauthorized);
        }
        validate_category_limits(&env, &category_daily);
        state.category_daily = category_daily;
        set_state(&env, &state);
    }

    /// Owner-only liquid band + auto-yield (USDC stroops).
    pub fn set_treasury_band(
        env: Env,
        owner: Address,
        liquid_low: i128,
        liquid_high: i128,
        auto_yield: bool,
    ) {
        owner.require_auth();
        let mut state = get_state(&env, &owner);
        if state.owner != owner {
            soroban_sdk::panic_with_error!(&env, limits::Error::Unauthorized);
        }
        validate_treasury_band(&env, liquid_low, liquid_high);
        state.liquid_low = liquid_low;
        state.liquid_high = liquid_high;
        state.auto_yield = auto_yield;
        set_state(&env, &state);
    }

    /// Read current limits, treasury band, and rolling-window spend.
    pub fn get_status(env: Env, owner: Address) -> Status {
        let state = get_state(&env, &owner);
        build_status(&env, &state)
    }

    /// Enforce global + category USDC limits and record spend. Requires owner auth.
    /// `amount` is USDC stroops (Hub converts XLM transfers before calling).
    pub fn check_spend(env: Env, owner: Address, category: SpendCategory, amount: i128) {
        owner.require_auth();
        let mut state = get_state(&env, &owner);
        if state.owner != owner {
            soroban_sdk::panic_with_error!(&env, limits::Error::Unauthorized);
        }

        enforce_amount(&env, &mut state, category, amount);

        if amount > 0 {
            record_spend(&env, &mut state, category, amount);
            set_state(&env, &state);
        }
    }
}

#[cfg(test)]
mod test;
