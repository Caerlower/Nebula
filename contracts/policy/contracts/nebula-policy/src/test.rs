#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, IntoVal};

fn setup(env: &Env) -> (Address, Address) {
    let contract_id = env.register(NebulaPolicyContract, ());
    let owner = Address::generate(env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::initialize(env.clone(), owner.clone(), 1_000_000, 5_000_000);
    });

    (contract_id, owner)
}

#[test]
fn initialize_and_get_status() {
    let env = Env::default();
    let (contract_id, owner) = setup(&env);

    env.as_contract(&contract_id, || {
        let status = NebulaPolicyContract::get_status(env.clone());
        assert_eq!(status.owner, owner);
        assert_eq!(status.max_per_call, 1_000_000);
        assert_eq!(status.max_per_day, 5_000_000);
        assert_eq!(status.daily_spent, 0);
        assert_eq!(status.daily_remaining, 5_000_000);
    });
}

#[test]
fn check_spend_under_limits_succeeds() {
    let env = Env::default();
    let (contract_id, _) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::check_spend(env.clone(), 500_000);

        let status = NebulaPolicyContract::get_status(env.clone());
        assert_eq!(status.daily_spent, 500_000);
        assert_eq!(status.daily_remaining, 4_500_000);
    });
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn check_spend_over_per_call_limit_reverts() {
    let env = Env::default();
    let (contract_id, _) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::check_spend(env.clone(), 1_500_000);
    });
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn check_spend_over_daily_limit_reverts() {
    let env = Env::default();
    let (contract_id, _) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::check_spend(env.clone(), 900_000);
        NebulaPolicyContract::check_spend(env.clone(), 900_000);
        NebulaPolicyContract::check_spend(env.clone(), 900_000);
    });
}

#[test]
fn set_limits_updates_without_redeploy() {
    let env = Env::default();
    let (contract_id, _) = setup(&env);

    env.as_contract(&contract_id, || {
        env.mock_all_auths();
        NebulaPolicyContract::set_limits(env.clone(), 2_000_000, 8_000_000);

        let status = NebulaPolicyContract::get_status(env.clone());
        assert_eq!(status.max_per_call, 2_000_000);
        assert_eq!(status.max_per_day, 8_000_000);

        NebulaPolicyContract::check_spend(env.clone(), 1_500_000);
        let after = NebulaPolicyContract::get_status(env.clone());
        assert_eq!(after.daily_spent, 1_500_000);
    });
}
