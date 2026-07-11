use soroban_sdk::{
    auth::{Context, ContractContext},
    contracterror, contracttype, panic_with_error, symbol_short, Address, Env, TryFromVal, Vec,
};

/// ~1 day on Stellar testnet/mainnet (5s ledgers).
pub const DAY_IN_LEDGERS: u32 = 17_280;
pub const MAX_HISTORY_ENTRIES: u32 = 1_000;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct SpendingEntry {
    pub amount: i128,
    pub ledger_sequence: u32,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PolicyState {
    pub owner: Address,
    pub max_per_call: i128,
    pub max_per_day: i128,
    pub period_ledgers: u32,
    pub spending_history: Vec<SpendingEntry>,
    pub cached_daily_spent: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Status {
    pub owner: Address,
    pub max_per_call: i128,
    pub max_per_day: i128,
    pub daily_spent: i128,
    pub daily_remaining: i128,
    pub period_ledgers: u32,
    pub history_len: u32,
}

#[contracttype]
pub enum DataKey {
    State,
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
}

pub fn validate_limits(env: &Env, max_per_call: i128, max_per_day: i128) {
    if max_per_call <= 0 || max_per_day <= 0 || max_per_call > max_per_day {
        panic_with_error!(env, Error::InvalidLimit);
    }
}

pub fn get_state(env: &Env) -> PolicyState {
    env.storage()
        .instance()
        .get(&DataKey::State)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
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

pub fn enforce_amount(env: &Env, state: &mut PolicyState, amount: i128) {
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
}

pub fn record_spend(env: &Env, state: &mut PolicyState, amount: i128) {
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
    });
    state.cached_daily_spent += amount;
}

/// Shared limit logic for future smart-account `enforce` wiring (not CLI-exposed).
pub fn enforce_for_transfer_context(
    env: &Env,
    state: &mut PolicyState,
    context: &Context,
    smart_account: &Address,
) {
    if smart_account != &state.owner {
        panic_with_error!(env, Error::Unauthorized);
    }

    let amount = extract_transfer_amount(env, context);
    enforce_amount(env, state, amount);

    if amount > 0 {
        record_spend(env, state, amount);
    }
}

fn extract_transfer_amount(env: &Env, context: &Context) -> i128 {
    match context {
        Context::Contract(ContractContext { fn_name, args, .. }) => {
            if fn_name != &symbol_short!("transfer") {
                panic_with_error!(env, Error::NotAllowed);
            }

            let amount_val = args
                .get(2)
                .unwrap_or_else(|| panic_with_error!(env, Error::NotAllowed));
            i128::try_from_val(env, &amount_val)
                .unwrap_or_else(|_| panic_with_error!(env, Error::NotAllowed))
        }
        _ => panic_with_error!(env, Error::NotAllowed),
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
