use soroban_sdk::{
    contracterror, contracttype, panic_with_error, Address, Env, Vec,
};

/// ~1 day on Stellar testnet/mainnet (5s ledgers).
pub const DAY_IN_LEDGERS: u32 = 17_280;
pub const MAX_HISTORY_ENTRIES: u32 = 1_000;

/// Outbound agent spend categories (Hub Policy UI).
/// Blend deposits are treasury moves, not spend — not capped here.
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum SpendCategory {
    Transfer = 0,
    X402 = 1,
    Mpp = 2,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct SpendingEntry {
    pub amount: i128,
    pub ledger_sequence: u32,
    pub category: SpendCategory,
}

/// Per-category daily caps (USDC stroops: 1 USDC = 10_000_000).
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CategoryLimits {
    pub transfer: i128,
    pub x402: i128,
    pub mpp: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PolicyState {
    pub owner: Address,
    /// Max amount per check_spend call (USDC stroops).
    pub max_per_call: i128,
    /// Global daily cap across all categories (USDC stroops).
    pub max_per_day: i128,
    pub category_daily: CategoryLimits,
    /// Liquid band low (USDC stroops): Hub pulls from Blend below this (after FX→XLM).
    pub liquid_low: i128,
    /// Liquid band high (USDC stroops): Hub parks to Blend above this (after FX→XLM).
    pub liquid_high: i128,
    /// When false, Hub must not auto-route Blend.
    pub auto_yield: bool,
    pub period_ledgers: u32,
    pub spending_history: Vec<SpendingEntry>,
    pub cached_daily_spent: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CategoryStatus {
    pub limit: i128,
    pub spent: i128,
    pub remaining: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Status {
    pub owner: Address,
    pub max_per_call: i128,
    pub max_per_day: i128,
    pub daily_spent: i128,
    pub daily_remaining: i128,
    pub liquid_low: i128,
    pub liquid_high: i128,
    pub auto_yield: bool,
    pub period_ledgers: u32,
    pub history_len: u32,
    pub transfer: CategoryStatus,
    pub x402: CategoryStatus,
    pub mpp: CategoryStatus,
}

#[contracttype]
pub enum DataKey {
    /// One policy slot per owner (Hub deploys one shared contract).
    Policy(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidLimit = 4,
    PerCallLimitExceeded = 5,
    DailyLimitExceeded = 6,
    NegativeAmount = 7,
    NotAllowed = 8,
    HistoryCapacityExceeded = 9,
    CategoryDailyLimitExceeded = 10,
    InvalidTreasuryBand = 11,
}

pub fn validate_limits(env: &Env, max_per_call: i128, max_per_day: i128) {
    if max_per_call <= 0 || max_per_day <= 0 || max_per_call > max_per_day {
        panic_with_error!(env, Error::InvalidLimit);
    }
}

pub fn validate_treasury_band(env: &Env, liquid_low: i128, liquid_high: i128) {
    if liquid_low < 0 || liquid_high < liquid_low {
        panic_with_error!(env, Error::InvalidTreasuryBand);
    }
}

pub fn validate_category_limits(env: &Env, cats: &CategoryLimits) {
    for limit in [cats.transfer, cats.x402, cats.mpp] {
        if limit < 0 {
            panic_with_error!(env, Error::InvalidLimit);
        }
    }
}

pub fn default_category_limits(max_per_day: i128) -> CategoryLimits {
    CategoryLimits {
        transfer: max_per_day,
        x402: max_per_day,
        mpp: max_per_day,
    }
}

pub fn get_state(env: &Env, owner: &Address) -> PolicyState {
    env.storage()
        .persistent()
        .get(&DataKey::Policy(owner.clone()))
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

pub fn set_state(env: &Env, state: &PolicyState) {
    env.storage()
        .persistent()
        .set(&DataKey::Policy(state.owner.clone()), state);
}

pub fn has_policy(env: &Env, owner: &Address) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Policy(owner.clone()))
}

pub fn category_limit(cats: &CategoryLimits, category: SpendCategory) -> i128 {
    match category {
        SpendCategory::Transfer => cats.transfer,
        SpendCategory::X402 => cats.x402,
        SpendCategory::Mpp => cats.mpp,
    }
}

pub fn compute_daily_spent(state: &PolicyState, current_ledger: u32) -> i128 {
    let cutoff = current_ledger.saturating_sub(state.period_ledgers);
    let mut total = 0i128;
    for entry in state.spending_history.iter() {
        if entry.ledger_sequence > cutoff {
            total += entry.amount;
        }
    }
    total
}

pub fn compute_category_spent(
    state: &PolicyState,
    category: SpendCategory,
    current_ledger: u32,
) -> i128 {
    let cutoff = current_ledger.saturating_sub(state.period_ledgers);
    let mut total = 0i128;
    for entry in state.spending_history.iter() {
        if entry.ledger_sequence > cutoff && entry.category == category {
            total += entry.amount;
        }
    }
    total
}

pub fn enforce_amount(
    env: &Env,
    state: &mut PolicyState,
    category: SpendCategory,
    amount: i128,
) {
    if amount < 0 {
        panic_with_error!(env, Error::NegativeAmount);
    }
    if amount == 0 {
        return;
    }

    if amount > state.max_per_call {
        panic_with_error!(env, Error::PerCallLimitExceeded);
    }

    let current_ledger = env.ledger().sequence();
    prune_history(state, current_ledger);

    if state.cached_daily_spent + amount > state.max_per_day {
        panic_with_error!(env, Error::DailyLimitExceeded);
    }

    let cat_limit = category_limit(&state.category_daily, category);
    let cat_spent = compute_category_spent(state, category, current_ledger);
    if cat_spent + amount > cat_limit {
        panic_with_error!(env, Error::CategoryDailyLimitExceeded);
    }
}

pub fn record_spend(
    env: &Env,
    state: &mut PolicyState,
    category: SpendCategory,
    amount: i128,
) {
    if amount <= 0 {
        return;
    }

    if state.spending_history.len() >= MAX_HISTORY_ENTRIES {
        panic_with_error!(env, Error::HistoryCapacityExceeded);
    }

    let current_ledger = env.ledger().sequence();
    prune_history(state, current_ledger);

    state.spending_history.push_back(SpendingEntry {
        amount,
        ledger_sequence: current_ledger,
        category,
    });
    state.cached_daily_spent += amount;
}

pub fn build_status(env: &Env, state: &PolicyState) -> Status {
    let current_ledger = env.ledger().sequence();
    let daily_spent = compute_daily_spent(state, current_ledger);

    let cat = |c: SpendCategory| -> CategoryStatus {
        let limit = category_limit(&state.category_daily, c);
        let spent = compute_category_spent(state, c, current_ledger);
        CategoryStatus {
            limit,
            spent,
            remaining: limit.saturating_sub(spent),
        }
    };

    Status {
        owner: state.owner.clone(),
        max_per_call: state.max_per_call,
        max_per_day: state.max_per_day,
        daily_spent,
        daily_remaining: state.max_per_day.saturating_sub(daily_spent),
        liquid_low: state.liquid_low,
        liquid_high: state.liquid_high,
        auto_yield: state.auto_yield,
        period_ledgers: state.period_ledgers,
        history_len: state.spending_history.len(),
        transfer: cat(SpendCategory::Transfer),
        x402: cat(SpendCategory::X402),
        mpp: cat(SpendCategory::Mpp),
    }
}

fn prune_history(state: &mut PolicyState, current_ledger: u32) {
    let cutoff = current_ledger.saturating_sub(state.period_ledgers);

    while let Some(entry) = state.spending_history.get(0) {
        if entry.ledger_sequence <= cutoff {
            state.cached_daily_spent -= entry.amount;
            state.spending_history.pop_front();
        } else {
            break;
        }
    }
}
