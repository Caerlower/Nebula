#![no_std]

mod limits;

use limits::{
    build_status, empty_buckets, enforce_amount, get_state, has_policy, record_spend, set_state,
    validate_category_limits, validate_limits, validate_treasury_band, CategoryLimits,
    DAY_IN_LEDGERS, Error, SpendCategory, Status,
};
use soroban_sdk::{contract, contractimpl, panic_with_error, symbol_short, Address, Env};

/// Nebula on-chain spending + treasury policy (multi-tenant).
///
/// One shared deploy. Each agent `G…` owns a slot and signs initialize / set_* /
/// pause / check_spend. Hub dashboard gates mutations (no MCP policy tools).
///
/// Units: USDC stroops (`10_000_000` = 1 USDC) for caps, categories, check_spend,
/// and the liquid band (band is published config only — Hub enforces Blend).
#[contract]
pub struct NebulaPolicyContract;

#[contractimpl]
#[allow(deprecated)] // events().publish → #[contractevent] later; Hub does not index yet
impl NebulaPolicyContract {
    /// One-time setup. Zero category = block; zero band floor is allowed.
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
        owner.require_auth();
        if has_policy(&env, &owner) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        validate_limits(&env, max_per_call, max_per_day);
        validate_category_limits(&env, &category_daily);
        validate_treasury_band(&env, liquid_low, liquid_high);

        set_state(
            &env,
            &limits::PolicyState {
                owner: owner.clone(),
                paused: false,
                max_per_call,
                max_per_day,
                category_daily,
                liquid_low,
                liquid_high,
                auto_yield,
                period_ledgers: DAY_IN_LEDGERS,
                buckets: empty_buckets(&env),
            },
        );
        env.events()
            .publish((symbol_short!("init"), owner), (max_per_call, max_per_day));
    }

    pub fn set_limits(env: Env, owner: Address, max_per_call: i128, max_per_day: i128) {
        owner.require_auth();
        let mut state = get_state(&env, &owner);
        validate_limits(&env, max_per_call, max_per_day);
        let old = (state.max_per_call, state.max_per_day);
        state.max_per_call = max_per_call;
        state.max_per_day = max_per_day;
        set_state(&env, &state);
        env.events()
            .publish((symbol_short!("limits"), owner), (old, (max_per_call, max_per_day)));
    }

    /// Zero = block that category.
    pub fn set_category_limits(env: Env, owner: Address, category_daily: CategoryLimits) {
        owner.require_auth();
        let mut state = get_state(&env, &owner);
        validate_category_limits(&env, &category_daily);
        state.category_daily = category_daily.clone();
        set_state(&env, &state);
        env.events().publish(
            (symbol_short!("cats"), owner),
            (category_daily.transfer, category_daily.x402, category_daily.mpp),
        );
    }

    /// Liquid band + auto-yield (published for Hub; not enforced here).
    pub fn set_treasury_band(
        env: Env,
        owner: Address,
        liquid_low: i128,
        liquid_high: i128,
        auto_yield: bool,
    ) {
        owner.require_auth();
        let mut state = get_state(&env, &owner);
        validate_treasury_band(&env, liquid_low, liquid_high);
        state.liquid_low = liquid_low;
        state.liquid_high = liquid_high;
        state.auto_yield = auto_yield;
        set_state(&env, &state);
        env.events()
            .publish((symbol_short!("band"), owner), (liquid_low, liquid_high, auto_yield));
    }

    /// Blocks `check_spend` only — `set_paused` still works while paused.
    pub fn set_paused(env: Env, owner: Address, paused: bool) {
        owner.require_auth();
        let mut state = get_state(&env, &owner);
        state.paused = paused;
        set_state(&env, &state);
        env.events()
            .publish((symbol_short!("pause"), owner), paused);
    }

    pub fn get_status(env: Env, owner: Address) -> Status {
        build_status(&env, &get_state(&env, &owner))
    }

    /// Enforce + record USDC spend (Hub converts XLM before calling).
    pub fn check_spend(env: Env, owner: Address, category: SpendCategory, amount: i128) {
        owner.require_auth();
        let mut state = get_state(&env, &owner);
        enforce_amount(&env, &state, category, amount);
        if amount > 0 {
            record_spend(&env, &mut state, category, amount);
            set_state(&env, &state);
            let (total, _, _, _) = limits::window_totals(&env, &state, env.ledger().sequence());
            env.events().publish(
                (symbol_short!("spend"), owner, category as u32),
                (amount, total),
            );
        }
    }
}

#[cfg(test)]
mod test;
