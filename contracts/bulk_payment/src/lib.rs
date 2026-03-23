#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, contractevent,
    Address, Env, Vec, token,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized     = 2,
    Unauthorized       = 3,
    EmptyBatch         = 4,
    BatchTooLarge      = 5,
    InvalidAmount      = 6,
    AmountOverflow     = 7,
    SequenceMismatch   = 8,
    BatchNotFound      = 9,
    EntryArchived      = 10,
}

// ── Events ────────────────────────────────────────────────────────────────────

#[contractevent]
pub struct BatchExecutedEvent {
    pub batch_id: u64,
    pub total_sent: i128,
}

#[contractevent]
pub struct BatchPartialEvent {
    pub batch_id: u64,
    pub success_count: u32,
    pub fail_count: u32,
}

#[contractevent]
pub struct PaymentSentEvent {
    pub recipient: Address,
    pub amount: i128,
}

#[contractevent]
pub struct PaymentSkippedEvent {
    pub recipient: Address,
    pub amount: i128,
}

// ── Storage types ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentOp {
    pub recipient: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchRecord {
    pub sender: Address,
    pub token: Address,
    pub total_sent: i128,
    pub success_count: u32,
    pub fail_count: u32,
    pub status: soroban_sdk::Symbol,
}

#[contracttype]
pub enum DataKey {
    Admin,
    BatchCount,
    Batch(u64),
    Sequence,
}

const MAX_BATCH_SIZE: u32 = 100;
const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;
const TEMPORARY_TTL_THRESHOLD: u32 = 2_000;
const TEMPORARY_TTL_EXTEND_TO: u32 = 20_000;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct BulkPaymentContract;

#[contractimpl]
impl BulkPaymentContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::BatchCount, &0u64);
        env.storage().persistent().set(&DataKey::Sequence, &0u64);
        Self::bump_core_ttl(&env);
        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        Self::bump_core_ttl(&env);
        Ok(())
    }

    /// Extends TTL for critical contract state to reduce archival risk.
    pub fn bump_ttl(env: Env) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        Self::bump_core_ttl(&env);
        Ok(())
    }

    /// All-or-nothing batch. Any failed transfer reverts the entire call.
    /// Wrap in a fee-bump transaction envelope off-chain for high-traffic scenarios.
    pub fn execute_batch(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
    ) -> Result<u64, ContractError> {
        sender.require_auth();
        Self::bump_core_ttl(&env);
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let len = payments.len();
        if len == 0 {
            return Err(ContractError::EmptyBatch);
        }
        if len > MAX_BATCH_SIZE {
            return Err(ContractError::BatchTooLarge);
        }

        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount <= 0 {
                return Err(ContractError::InvalidAmount);
            }
            total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
        }

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &total);

        for op in payments.iter() {
            token_client.transfer(&env.current_contract_address(), &op.recipient, &op.amount);
        }

        let batch_id = Self::next_batch_id(&env);
        env.storage().temporary().set(&DataKey::Batch(batch_id), &BatchRecord {
            sender,
            token,
            total_sent: total,
            success_count: len,
            fail_count: 0,
            status: soroban_sdk::symbol_short!("completed"),
        });
        env.storage().temporary().extend_ttl(
            &DataKey::Batch(batch_id),
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        BatchExecutedEvent { batch_id, total_sent: total };
        Ok(batch_id)
    }

    /// Best-effort batch. Skips payments that exceed remaining balance and refunds the sender.
    pub fn execute_batch_partial(
        env: Env,
        sender: Address,
        token: Address,
        payments: Vec<PaymentOp>,
        expected_sequence: u64,
    ) -> Result<u64, ContractError> {
        sender.require_auth();
        Self::bump_core_ttl(&env);
        Self::check_and_advance_sequence(&env, expected_sequence)?;

        let len = payments.len();
        if len == 0 {
            return Err(ContractError::EmptyBatch);
        }
        if len > MAX_BATCH_SIZE {
            return Err(ContractError::BatchTooLarge);
        }

        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount > 0 {
                total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
            }
        }

        let token_client = token::Client::new(&env, &token);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&sender, &contract_addr, &total);

        let mut remaining = total;
        let mut success_count: u32 = 0;
        let mut fail_count: u32 = 0;
        let mut total_sent: i128 = 0;

        for op in payments.iter() {
            if op.amount <= 0 || remaining < op.amount {
                fail_count += 1;
                PaymentSkippedEvent {
                    recipient: op.recipient.clone(),
                    amount: op.amount,
                }
               ;
                continue;
            }
            token_client.transfer(&contract_addr, &op.recipient, &op.amount);
            remaining -= op.amount;
            total_sent += op.amount;
            success_count += 1;
            PaymentSentEvent {
                recipient: op.recipient.clone(),
                amount: op.amount,
            }
            ;
        }

        if remaining > 0 {
            token_client.transfer(&contract_addr, &sender, &remaining);
        }

        let status = if fail_count == 0 {
            soroban_sdk::symbol_short!("completed")
        } else if success_count == 0 {
            soroban_sdk::symbol_short!("rollbck")
        } else {
            soroban_sdk::symbol_short!("partial")
        };

        let batch_id = Self::next_batch_id(&env);
        env.storage().temporary().set(&DataKey::Batch(batch_id), &BatchRecord {
            sender,
            token,
            total_sent,
            success_count,
            fail_count,
            status,
        });
        env.storage().temporary().extend_ttl(
            &DataKey::Batch(batch_id),
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        BatchPartialEvent { batch_id, success_count, fail_count };
        Ok(batch_id)
    }

    pub fn get_sequence(env: Env) -> u64 {
        let key = DataKey::Sequence;
        if let Some(value) = env.storage().persistent().get(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
            value
        } else {
            0
        }
    }

    pub fn get_batch(env: Env, batch_id: u64) -> Result<BatchRecord, ContractError> {
        let key = DataKey::Batch(batch_id);
        let record = env.storage().temporary().get(&key).ok_or(ContractError::BatchNotFound)?;
        env.storage().temporary().extend_ttl(
            &key,
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );
        Ok(record)
    }

    pub fn get_batch_count(env: Env) -> u64 {
        let key = DataKey::BatchCount;
        if let Some(value) = env.storage().persistent().get(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                PERSISTENT_TTL_THRESHOLD,
                PERSISTENT_TTL_EXTEND_TO,
            );
            value
        } else {
            0
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn require_admin(env: &Env) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::EntryArchived)?;
        env.storage().persistent().extend_ttl(
            &DataKey::Admin,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        admin.require_auth();
        Ok(())
    }

    fn check_and_advance_sequence(env: &Env, expected: u64) -> Result<(), ContractError> {
        let current: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::Sequence)
            .ok_or(ContractError::EntryArchived)?;
        if current != expected {
            return Err(ContractError::SequenceMismatch);
        }
        env.storage().persistent().set(&DataKey::Sequence, &(current + 1));
        env.storage().persistent().extend_ttl(
            &DataKey::Sequence,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        Ok(())
    }

    fn next_batch_id(env: &Env) -> u64 {
        let count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::BatchCount)
            .unwrap_or(0)
            + 1;
        env.storage().persistent().set(&DataKey::BatchCount, &count);
        env.storage().persistent().extend_ttl(
            &DataKey::BatchCount,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        count
    }

    fn bump_core_ttl(env: &Env) {
        for key in [DataKey::Admin, DataKey::BatchCount, DataKey::Sequence] {
            if env.storage().persistent().has(&key) {
                env.storage().persistent().extend_ttl(
                    &key,
                    PERSISTENT_TTL_THRESHOLD,
                    PERSISTENT_TTL_EXTEND_TO,
                );
            }
        }
    }
}

#[cfg(test)]
mod test;