#![cfg(test)]

extern crate std;

use super::*;
use limits::{CategoryLimits, SpendCategory, BUCKET_LEDGERS, DAY_IN_LEDGERS};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

fn cats(day: i128) -> CategoryLimits {
    CategoryLimits {
        transfer: day,
        x402: day / 2,
        mpp: day / 2,
    }
}

fn setup(env: &Env) -> (Address, Address) {
    let contract_id = env.register(NebulaPolicyContract, ());
    let owner = Address::generate(env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::initialize(
            env.clone(),
            owner.clone(),
            1_000_000,
            5_000_000,
            cats(5_000_000),
            2_000_000,
            10_000_000,
            true,
        );
    });

    (contract_id, owner)
}

fn advance_ledgers(env: &Env, n: u32) {
    let mut info = env.ledger().get();
    info.sequence_number = info.sequence_number.saturating_add(n);
    env.ledger().set(info);
}

#[test]
fn initialize_and_get_status() {
    let env = Env::default();
    let (contract_id, owner) = setup(&env);

    env.as_contract(&contract_id, || {
        let status = NebulaPolicyContract::get_status(env.clone(), owner.clone());
        assert_eq!(status.owner, owner);
        assert!(!status.paused);
        assert_eq!(status.max_per_call, 1_000_000);
        assert_eq!(status.max_per_day, 5_000_000);
        assert_eq!(status.daily_spent, 0);
        assert_eq!(status.transfer.limit, 5_000_000);
        assert_eq!(status.x402.limit, 2_500_000);
    });
}

#[test]
fn check_spend_under_limits_succeeds() {
    let env = Env::default();
    let (contract_id, owner) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::check_spend(
            env.clone(),
            owner.clone(),
            SpendCategory::Transfer,
            500_000,
        );

        let status = NebulaPolicyContract::get_status(env.clone(), owner);
        assert_eq!(status.daily_spent, 500_000);
        assert_eq!(status.transfer.spent, 500_000);
        assert_eq!(status.x402.spent, 0);
        assert_eq!(status.daily_remaining, 4_500_000);
    });
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn check_spend_over_per_call_limit_reverts() {
    let env = Env::default();
    let (contract_id, owner) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::check_spend(
            env.clone(),
            owner,
            SpendCategory::Transfer,
            1_500_000,
        );
    });
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn check_spend_over_daily_limit_reverts() {
    let env = Env::default();
    let (contract_id, owner) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        for _ in 0..6 {
            NebulaPolicyContract::check_spend(
                env.clone(),
                owner.clone(),
                SpendCategory::Transfer,
                900_000,
            );
        }
    });
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn check_spend_over_category_daily_reverts() {
    let env = Env::default();
    let (contract_id, owner) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::check_spend(
            env.clone(),
            owner.clone(),
            SpendCategory::X402,
            900_000,
        );
        NebulaPolicyContract::check_spend(
            env.clone(),
            owner.clone(),
            SpendCategory::X402,
            900_000,
        );
        NebulaPolicyContract::check_spend(
            env.clone(),
            owner,
            SpendCategory::X402,
            900_000,
        );
    });
}

/// C1 regression: many dust spends must not flush real spend out of the window.
#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn dust_flood_cannot_bypass_daily_cap() {
    let env = Env::default();
    let (contract_id, owner) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::check_spend(
            env.clone(),
            owner.clone(),
            SpendCategory::Transfer,
            1_000_000,
        );
        for _ in 0..2_000 {
            NebulaPolicyContract::check_spend(
                env.clone(),
                owner.clone(),
                SpendCategory::X402,
                1,
            );
        }
        for _ in 0..3 {
            NebulaPolicyContract::check_spend(
                env.clone(),
                owner.clone(),
                SpendCategory::Transfer,
                1_000_000,
            );
        }
        NebulaPolicyContract::check_spend(
            env.clone(),
            owner,
            SpendCategory::Transfer,
            1_000_000,
        );
    });
}

#[test]
fn bucket_recycles_after_day() {
    let env = Env::default();
    let (contract_id, owner) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::check_spend(
            env.clone(),
            owner.clone(),
            SpendCategory::Transfer,
            1_000_000,
        );
        let mid = NebulaPolicyContract::get_status(env.clone(), owner.clone());
        assert_eq!(mid.daily_spent, 1_000_000);
    });

    advance_ledgers(&env, DAY_IN_LEDGERS + BUCKET_LEDGERS);

    env.as_contract(&contract_id, || {
        let after = NebulaPolicyContract::get_status(env.clone(), owner.clone());
        assert_eq!(after.daily_spent, 0);
        env.mock_all_auths();
        NebulaPolicyContract::check_spend(
            env.clone(),
            owner.clone(),
            SpendCategory::Transfer,
            1_000_000,
        );
        let again = NebulaPolicyContract::get_status(env.clone(), owner);
        assert_eq!(again.daily_spent, 1_000_000);
    });
}

#[test]
fn owner_can_set_limits_and_unpause_while_paused() {
    let env = Env::default();
    let (contract_id, owner) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::set_limits(env.clone(), owner.clone(), 2_000_000, 8_000_000);
        NebulaPolicyContract::set_category_limits(
            env.clone(),
            owner.clone(),
            CategoryLimits {
                transfer: 3_000_000,
                x402: 0,
                mpp: 1_000_000,
            },
        );
        NebulaPolicyContract::set_treasury_band(
            env.clone(),
            owner.clone(),
            5_000_000,
            25_000_000,
            false,
        );
        NebulaPolicyContract::set_paused(env.clone(), owner.clone(), true);

        let status = NebulaPolicyContract::get_status(env.clone(), owner.clone());
        assert_eq!(status.max_per_call, 2_000_000);
        assert_eq!(status.max_per_day, 8_000_000);
        assert_eq!(status.transfer.limit, 3_000_000);
        assert_eq!(status.x402.limit, 0);
        assert!(status.paused);
        assert!(!status.auto_yield);

        // Resume while paused — set_paused is not gated by paused flag.
        NebulaPolicyContract::set_paused(env.clone(), owner.clone(), false);
        NebulaPolicyContract::check_spend(
            env.clone(),
            owner.clone(),
            SpendCategory::Transfer,
            1_500_000,
        );
        let after = NebulaPolicyContract::get_status(env.clone(), owner);
        assert_eq!(after.daily_spent, 1_500_000);
        assert!(!after.paused);
    });
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn paused_blocks_spend() {
    let env = Env::default();
    let (contract_id, owner) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::set_paused(env.clone(), owner.clone(), true);
        NebulaPolicyContract::check_spend(
            env.clone(),
            owner,
            SpendCategory::Transfer,
            100_000,
        );
    });
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn set_treasury_band_rejects_high_below_low() {
    let env = Env::default();
    let (contract_id, owner) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::set_treasury_band(
            env.clone(),
            owner,
            10_000_000,
            5_000_000,
            true,
        );
    });
}

#[test]
fn zero_category_means_blocked_not_default() {
    let env = Env::default();
    let contract_id = env.register(NebulaPolicyContract, ());
    let owner = Address::generate(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::initialize(
            env.clone(),
            owner.clone(),
            1_000_000,
            4_000_000,
            CategoryLimits {
                transfer: 4_000_000,
                x402: 0,
                mpp: 0,
            },
            2_000_000,
            10_000_000,
            false,
        );
        let status = NebulaPolicyContract::get_status(env.clone(), owner);
        assert_eq!(status.x402.limit, 0);
        assert_eq!(status.mpp.limit, 0);
        assert!(!status.auto_yield);
    });
}
