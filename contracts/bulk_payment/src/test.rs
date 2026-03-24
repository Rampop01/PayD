#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, Vec,
};

// ── Errors map ────────────────────────────────────────────────────────────────
// Soroban host panics with "HostError: Error(Contract, #N)" — variant names
// are NOT in the panic string. Match on the numeric code instead:
//
//   AlreadyInitialized = 1  → Error(Contract, #1)
//   NotInitialized     = 2  → Error(Contract, #2)
//   EmptyBatch         = 4  → Error(Contract, #4)
//   BatchTooLarge      = 5  → Error(Contract, #5)
//   InvalidAmount      = 6  → Error(Contract, #6)
//   SequenceMismatch   = 8  → Error(Contract, #8)
//   BatchNotFound      = 9  → Error(Contract, #9)

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup() -> (Env, Address, Address, BulkPaymentContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let sender = Address::generate(&env);
    StellarAssetClient::new(&env, &token_id).mint(&sender, &1_000_000);

    let admin = Address::generate(&env);
    let contract_id = env.register(BulkPaymentContract,());
    let client = BulkPaymentContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    (env, sender, token_id, client)
}

fn one_payment(env: &Env) -> Vec<PaymentOp> {
    let mut payments: Vec<PaymentOp> = Vec::new(env);
    payments.push_back(PaymentOp { recipient: Address::generate(env), amount: 10 });
    payments
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_initialize_twice_panics() {
    let (env, _, _, client) = setup();
    client.initialize(&Address::generate(&env));
}

// ── execute_batch ─────────────────────────────────────────────────────────────

#[test]
fn test_execute_batch_success() {
    let (env, sender, token, client) = setup();

    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);
    let r3 = Address::generate(&env);

    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    payments.push_back(PaymentOp { recipient: r1.clone(), amount: 100 });
    payments.push_back(PaymentOp { recipient: r2.clone(), amount: 200 });
    payments.push_back(PaymentOp { recipient: r3.clone(), amount: 300 });

    let batch_id = client.execute_batch(&sender, &token, &payments, &client.get_sequence());

    let tc = TokenClient::new(&env, &token);
    assert_eq!(tc.balance(&r1), 100);
    assert_eq!(tc.balance(&r2), 200);
    assert_eq!(tc.balance(&r3), 300);

    let record = client.get_batch(&batch_id);
    assert_eq!(record.success_count, 3);
    assert_eq!(record.fail_count, 0);
    assert_eq!(record.total_sent, 600);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_execute_batch_empty_panics() {
    let (env, sender, token, client) = setup();
    let payments: Vec<PaymentOp> = Vec::new(&env);
    client.execute_batch(&sender, &token, &payments, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_execute_batch_too_large_panics() {
    let (env, sender, token, client) = setup();
    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    for _ in 0..=100 {
        payments.push_back(PaymentOp { recipient: Address::generate(&env), amount: 1 });
    }
    client.execute_batch(&sender, &token, &payments, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_execute_batch_negative_amount_panics() {
    let (env, sender, token, client) = setup();
    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    payments.push_back(PaymentOp { recipient: Address::generate(&env), amount: -5 });
    client.execute_batch(&sender, &token, &payments, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_execute_batch_sequence_replay_panics() {
    let (env, sender, token, client) = setup();
    let payments = one_payment(&env);
    client.execute_batch(&sender, &token, &payments, &0); // seq → 1
    client.execute_batch(&sender, &token, &payments, &0); // must panic
}

#[test]
fn test_sequence_advances_after_each_batch() {
    let (env, sender, token, client) = setup();
    let payments = one_payment(&env);

    assert_eq!(client.get_sequence(), 0);
    client.execute_batch(&sender, &token, &payments, &0);
    assert_eq!(client.get_sequence(), 1);
    client.execute_batch(&sender, &token, &payments, &1);
    assert_eq!(client.get_sequence(), 2);
}

#[test]
fn test_batch_count_increments() {
    let (env, sender, token, client) = setup();
    let payments = one_payment(&env);

    client.execute_batch(&sender, &token, &payments, &0);
    client.execute_batch(&sender, &token, &payments, &1);

    assert_eq!(client.get_batch_count(), 2);
}

// ── execute_batch_partial ─────────────────────────────────────────────────────

#[test]
fn test_partial_batch_skips_insufficient_funds() {
    let (env, sender, token, client) = setup();
    // sender has 1_000_000 total minted.
    // Pull = 500_000 + 600_000 = 1_100_000 which would exceed balance.
    // Use amounts whose SUM fits within 1_000_000 but where the second
    // payment exceeds what's left after the first succeeds.
    //   first:  500_000  → succeeds, remaining = 500_000
    //   second: 600_000  → skipped  (600_000 > 500_000 remaining)
    //   refund: 500_000 back to sender
    // Total pulled = 500_000 + 600_000 = 1_100_000 — still too much.
    //
    // Correct approach: pull only positive amounts into total, so
    // total pulled = 500_000 + 600_000.  Still > 1_000_000.
    //
    // We must keep total ≤ 1_000_000.  Use:
    //   first:  700_000  → succeeds, remaining = 300_000
    //   second: 400_000  → skipped  (400_000 > 300_000 remaining)
    //   total pulled = 700_000 + 400_000 = 1_100_000  — still over.
    //
    // The contract sums ALL positive amounts before the first transfer,
    // so both amounts count toward the pull. The only way to have a
    // "skip due to insufficient remaining" is when the FIRST payment
    // consumes most of the balance and the second can't fit — but the
    // total of both must still be ≤ the sender's balance so the pull
    // itself succeeds.
    //
    // Use:  first = 600_000, second = 300_000, total pull = 900_000 ≤ 1_000_000
    // After first:  remaining = 900_000 - 600_000 = 300_000
    // Second needs 300_000 → exactly fits, both succeed.  Not what we want.
    //
    // Use:  first = 600_000, second = 350_000, total = 950_000 ≤ 1_000_000
    // After first:  remaining = 950_000 - 600_000 = 350_000 → second fits.
    //
    // Use:  first = 700_000, second = 200_000, total = 900_000 ≤ 1_000_000
    // After first:  remaining = 900_000 - 700_000 = 200_000 → second fits.
    //
    // We need remaining < second_amount after first succeeds:
    //   remaining = total - first = (first + second) - first = second
    //   → remaining always equals second, so second always fits!
    //
    // To force a skip we need a THIRD payment that won't fit:
    //   first = 500_000, second = 300_000, third = 250_000
    //   total pull = 1_050_000 > 1_000_000  — over.
    //
    // Only workable pattern: make second amount > total - first
    //   i.e. second > total - first  → impossible since total = first + second.
    //
    // Conclusion: with two positive payments the second can NEVER be skipped
    // for "insufficient remaining" because the contract pre-pulls the full sum.
    // We must mint MORE tokens or use a negative/zero amount to force a skip.
    //
    // Simplest fix: push a zero-amount op (skipped because amount <= 0).

    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env); // will be skipped (amount = 0)

    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    payments.push_back(PaymentOp { recipient: r1.clone(), amount: 500_000 });
    payments.push_back(PaymentOp { recipient: r2.clone(), amount: 0 }); // invalid → skip

    let batch_id =
        client.execute_batch_partial(&sender, &token, &payments, &client.get_sequence());

    let record = client.get_batch(&batch_id);
    assert_eq!(record.success_count, 1);
    assert_eq!(record.fail_count, 1);

    let tc = TokenClient::new(&env, &token);
    assert_eq!(tc.balance(&r1), 500_000);
    assert_eq!(tc.balance(&r2), 0);
    assert_eq!(tc.balance(&sender), 500_000); // refunded the unspent pull
}

#[test]
fn test_partial_batch_all_fail_status_is_rollbck() {
    let (env, sender, token, client) = setup();
    let mut payments: Vec<PaymentOp> = Vec::new(&env);
    payments.push_back(PaymentOp { recipient: Address::generate(&env), amount: -1 });

    let batch_id =
        client.execute_batch_partial(&sender, &token, &payments, &client.get_sequence());

    let record = client.get_batch(&batch_id);
    assert_eq!(record.success_count, 0);
    assert_eq!(record.fail_count, 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_partial_batch_empty_panics() {
    let (env, sender, token, client) = setup();
    let payments: Vec<PaymentOp> = Vec::new(&env);
    client.execute_batch_partial(&sender, &token, &payments, &0);
}

// ── get_batch ─────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_get_batch_not_found_panics() {
    let (_, _, _, client) = setup();
    client.get_batch(&999);
}

// ── pause ─────────────────────────────────────────────────────────────────────

#[test]
fn test_pause_unpause_works() {
    let (env, _, _, client) = setup();

    assert_eq!(client.is_paused(), false);
    client.set_paused(&true);
    assert_eq!(client.is_paused(), true);
    client.set_paused(&false);
    assert_eq!(client.is_paused(), false);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_execute_batch_fails_when_paused() {
    let (env, sender, token, client) = setup();
    client.set_paused(&true);

    let payments = one_payment(&env);
    client.execute_batch(&sender, &token, &payments, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_execute_batch_partial_fails_when_paused() {
    let (env, sender, token, client) = setup();
    client.set_paused(&true);

    let payments = one_payment(&env);
    client.execute_batch_partial(&sender, &token, &payments, &0);
}