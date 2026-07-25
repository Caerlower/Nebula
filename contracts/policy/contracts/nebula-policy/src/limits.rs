use soroban_sdk::{
    contracterror, contracttype, panic_with_error, Address, Env, Vec,
};

/// ~1 day on Stellar testnet/mainnet (5s ledgers).
pub const DAY_IN_LEDGERS: u32 = 17_280;
const BUCKETS_PER_DAY: u32 = 24;
/// Hourly bucket width; exported for tests.
pub const BUCKET_LEDGERS: u32 = DAY_IN_LEDGERS / BUCKETS_PER_DAY; // 720
const POLICY_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const POLICY_TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;

/// Outbound agent spend (Hub Policy UI). Blend deposits are not capped here.
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
pub struct SpendBucket {
    /// Absolute index = ledger_sequence / BUCKET_LEDGERS.
    pub index: u32,
    pub transfer: i128,
    pub x402: i128,
    pub mpp: i128,
}

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
    /// Agent address (slot key); signs initialize, set_*, pause, check_spend.
    pub owner: Address,
    pub paused: bool,
    pub max_per_call: i128,
    pub max_per_day: i128,
    pub category_daily: CategoryLimits,
    /// Published Hub config (USDC stroops); not enforced on-chain.
    pub liquid_low: i128,
    pub liquid_high: i128,
    pub auto_yield: bool,
    pub period_ledgers: u32,
    pub buckets: Vec<SpendBucket>,
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
    pub paused: bool,
    pub max_per_call: i128,
    pub max_per_day: i128,
    pub daily_spent: i128,
    pub daily_remaining: i128,
    pub liquid_low: i128,
    pub liquid_high: i128,
    pub auto_yield: bool,
    pub period_ledgers: u32,
    pub transfer: CategoryStatus,
    pub x402: CategoryStatus,
    pub mpp: CategoryStatus,
}

#[contracttype]
pub enum DataKey {
    Policy(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    /// Unused — auth failures come from host `require_auth`. Kept for ABI.
    Unauthorized = 3,
    InvalidLimit = 4,
    PerCallLimitExceeded = 5,
    DailyLimitExceeded = 6,
    NegativeAmount = 7,
    /// Unused. Kept for ABI.
    NotAllowed = 8,
    /// Legacy ring-buffer overflow. Kept for ABI.
    HistoryCapacityExceeded = 9,
    CategoryDailyLimitExceeded = 10,
    InvalidTreasuryBand = 11,
    /// Legacy admin/subject experiment. Kept for ABI.
    InvalidRoles = 12,
    Paused = 13,
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

fn bucket_index(ledger: u32) -> u32 {
    ledger / BUCKET_LEDGERS
}

fn zero_bucket(index: u32) -> SpendBucket {
    SpendBucket {
        index,
        transfer: 0,
        x402: 0,
        mpp: 0,
    }
}

fn checked_add(env: &Env, a: i128, b: i128) -> i128 {
    a.checked_add(b)
        .unwrap_or_else(|| panic_with_error!(env, Error::InvalidLimit))
}

pub fn empty_buckets(env: &Env) -> Vec<SpendBucket> {
    let mut v = Vec::new(env);
    for _ in 0..BUCKETS_PER_DAY {
        v.push_back(zero_bucket(0));
    }
    v
}

/// (total, transfer, x402, mpp) across live buckets. O(24).
pub fn window_totals(
    env: &Env,
    state: &PolicyState,
    current_ledger: u32,
) -> (i128, i128, i128, i128) {
    let ci = bucket_index(current_ledger);
    let (mut t, mut x, mut m) = (0i128, 0i128, 0i128);
    for b in state.buckets.iter() {
        if ci.saturating_sub(b.index) < BUCKETS_PER_DAY {
            t = checked_add(env, t, b.transfer);
            x = checked_add(env, x, b.x402);
            m = checked_add(env, m, b.mpp);
        }
    }
    (checked_add(env, checked_add(env, t, x), m), t, x, m)
}

fn extend_policy_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, POLICY_TTL_THRESHOLD, POLICY_TTL_EXTEND_TO);
}

pub fn get_state(env: &Env, owner: &Address) -> PolicyState {
    let key = DataKey::Policy(owner.clone());
    let state = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
    extend_policy_ttl(env, &key);
    state
}

pub fn set_state(env: &Env, state: &PolicyState) {
    let key = DataKey::Policy(state.owner.clone());
    env.storage().persistent().set(&key, state);
    extend_policy_ttl(env, &key);
}

pub fn has_policy(env: &Env, owner: &Address) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Policy(owner.clone()))
}

pub fn enforce_amount(
    env: &Env,
    state: &PolicyState,
    category: SpendCategory,
    amount: i128,
) {
    if state.paused {
        panic_with_error!(env, Error::Paused);
    }
    if amount < 0 {
        panic_with_error!(env, Error::NegativeAmount);
    }
    if amount == 0 {
        return;
    }
    if amount > state.max_per_call {
        panic_with_error!(env, Error::PerCallLimitExceeded);
    }

    let (total, t, x, m) = window_totals(env, state, env.ledger().sequence());
    if total.saturating_add(amount) > state.max_per_day {
        panic_with_error!(env, Error::DailyLimitExceeded);
    }

    let (spent, limit) = match category {
        SpendCategory::Transfer => (t, state.category_daily.transfer),
        SpendCategory::X402 => (x, state.category_daily.x402),
        SpendCategory::Mpp => (m, state.category_daily.mpp),
    };
    if spent.saturating_add(amount) > limit {
        panic_with_error!(env, Error::CategoryDailyLimitExceeded);
    }
}

/// Caller must pass `amount > 0` (see `check_spend`).
pub fn record_spend(
    env: &Env,
    state: &mut PolicyState,
    category: SpendCategory,
    amount: i128,
) {
    let ci = bucket_index(env.ledger().sequence());
    let slot = ci % BUCKETS_PER_DAY;
    let mut b = state.buckets.get(slot).unwrap_or_else(|| zero_bucket(ci));
    if b.index != ci {
        b = zero_bucket(ci);
    }
    match category {
        SpendCategory::Transfer => b.transfer = checked_add(env, b.transfer, amount),
        SpendCategory::X402 => b.x402 = checked_add(env, b.x402, amount),
        SpendCategory::Mpp => b.mpp = checked_add(env, b.mpp, amount),
    }
    state.buckets.set(slot, b);
}

pub fn build_status(env: &Env, state: &PolicyState) -> Status {
    let (daily_spent, t, x, m) = window_totals(env, state, env.ledger().sequence());
    let cat = |limit: i128, spent: i128| CategoryStatus {
        limit,
        spent,
        remaining: limit.saturating_sub(spent),
    };
    Status {
        owner: state.owner.clone(),
        paused: state.paused,
        max_per_call: state.max_per_call,
        max_per_day: state.max_per_day,
        daily_spent,
        daily_remaining: state.max_per_day.saturating_sub(daily_spent),
        liquid_low: state.liquid_low,
        liquid_high: state.liquid_high,
        auto_yield: state.auto_yield,
        period_ledgers: state.period_ledgers,
        transfer: cat(state.category_daily.transfer, t),
        x402: cat(state.category_daily.x402, x),
        mpp: cat(state.category_daily.mpp, m),
    }
}
