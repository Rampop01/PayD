#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, contractevent,
    Address, Env, Vec, token, symbol_short, Symbol,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized  = 1,
    NotInitialized      = 2,
    Unauthorized        = 3,
    EmptyBatch          = 4,
    BatchTooLarge       = 5,
    InvalidAmount       = 6,
    AmountOverflow      = 7,
    SequenceMismatch    = 8,
    BatchNotFound       = 9,
    DailyLimitExceeded  = 10,
    WeeklyLimitExceeded = 11,
    MonthlyLimitExceeded = 12,
    InvalidLimitConfig  = 13,
}

// ── Events ────────────────────────────────────────────────────────────────────

#[contractevent]
pub struct BonusPaymentEvent {
    pub batch_id: u64,
    pub recipient: Address,
    pub amount: i128,
    pub category: Symbol,
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

#[contractevent]
pub struct TransactionBlockedEvent {
    pub account: Address,
    pub attempted_amount: i128,
    pub limit_type: LimitTier,
    pub current_usage: i128,
    pub cap: i128,
}

#[contractevent]
pub struct LimitsUpdatedEvent {
    pub account: Address,
    pub daily_limit: i128,
    pub weekly_limit: i128,
    pub monthly_limit: i128,
}

// ── Storage types ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentOp {
    pub recipient: Address,
    pub amount: i128,
    pub category: Symbol,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchRecord {
    pub sender: Address,
    pub token: Address,
    pub total_sent: i128,
    pub success_count: u32,
    pub fail_count: u32,
    pub status: Symbol,
}

/// Configurable limit tiers per account.
/// A cap value of 0 means "no limit" for that tier.
#[contracttype]
#[derive(Clone, Debug)]
pub struct AccountLimits {
    pub daily_limit: i128,
    pub weekly_limit: i128,
    pub monthly_limit: i128,
}

/// Tracks cumulative spending within each rolling window.
#[contracttype]
#[derive(Clone, Debug)]
pub struct AccountUsage {
    pub daily_spent: i128,
    pub daily_reset_ledger: u32,
    pub weekly_spent: i128,
    pub weekly_reset_ledger: u32,
    pub monthly_spent: i128,
    pub monthly_reset_ledger: u32,
}

/// Tier identifier used in events.
#[contracttype]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum LimitTier {
    Daily   = 0,
    Weekly  = 1,
    Monthly = 2,
}

#[contracttype]
pub enum DataKey {
    Admin,
    BatchCount,
    Batch(u64),
    Sequence,
    /// Per-account configurable limits
    AcctLimits(Address),
    /// Per-account rolling usage tracker
    AcctUsage(Address),
    /// Default limits applied to all accounts without overrides
    DefaultLimits,
    TotalBonusesPaid,
}

const MAX_BATCH_SIZE: u32 = 100;
const PERSISTENT_TTL_THRESHOLD: u32 = 20_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 120_000;
const TEMPORARY_TTL_THRESHOLD: u32 = 2_000;
const TEMPORARY_TTL_EXTEND_TO: u32 = 20_000;

// Approximate ledger counts for time windows.
// Stellar closes a ledger roughly every 5 seconds.
// Daily  ≈ 86_400 / 5 = 17_280
// Weekly ≈ 7 × 17_280 = 120_960
// Monthly ≈ 30 × 17_280 = 518_400
const LEDGERS_PER_DAY: u32   = 17_280;
const LEDGERS_PER_WEEK: u32  = 120_960;
const LEDGERS_PER_MONTH: u32 = 518_400;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct BulkPaymentContract;

#[contractimpl]
impl BulkPaymentContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        let storage = env.storage().instance();
        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::BatchCount, &0u64);
        storage.set(&DataKey::Sequence, &0u64);
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

    // ── Limit management (admin-only) ─────────────────────────────────────

    /// Set default limits applied to all accounts that don't have overrides.
    /// A cap of 0 means "unlimited" for that tier.
    pub fn set_default_limits(
        env: Env,
        daily: i128,
        weekly: i128,
        monthly: i128,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        Self::validate_limits(daily, weekly, monthly)?;

        let limits = AccountLimits {
            daily_limit: daily,
            weekly_limit: weekly,
            monthly_limit: monthly,
        };
        env.storage().instance().set(&DataKey::DefaultLimits, &limits);
        Ok(())
    }

    /// Override limits for a specific trusted account.
    /// A cap of 0 means "unlimited" for that tier.
    pub fn set_account_limits(
        env: Env,
        account: Address,
        daily: i128,
        weekly: i128,
        monthly: i128,
    ) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        Self::validate_limits(daily, weekly, monthly)?;

        let limits = AccountLimits {
            daily_limit: daily,
            weekly_limit: weekly,
            monthly_limit: monthly,
        };
        env.storage().persistent().set(&DataKey::AcctLimits(account.clone()), &limits);

        LimitsUpdatedEvent {
            account,
            daily_limit: daily,
            weekly_limit: weekly,
            monthly_limit: monthly,
        };

        Ok(())
    }

    /// Remove per-account overrides so the account falls back to default limits.
    pub fn remove_account_limits(env: Env, account: Address) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        env.storage().persistent().remove(&DataKey::AcctLimits(account));
        Ok(())
    }

    /// Query the effective limits for an account (per-account override or defaults).
    pub fn get_account_limits(env: Env, account: Address) -> AccountLimits {
        Self::effective_limits(&env, &account)
    }

    /// Query the current usage counters for an account.
    pub fn get_account_usage(env: Env, account: Address) -> AccountUsage {
        Self::current_usage(&env, &account)
    }

    // ── Batch execution ───────────────────────────────────────────────────

    /// All-or-nothing batch. Any failed transfer reverts the entire call.
    /// Wrap in a fee-bump transaction envelope off-chain for high-traffic scenarios.
    /// Gas-optimized all-or-nothing batch payment.
    ///
    /// Optimizations vs. the original implementation:
    /// 1. **Direct sender→recipient transfers** — eliminates the intermediate
    ///    contract hop (sender→contract→recipient), cutting token transfer
    ///    cross-contract calls from 2N+1 down to N for N payments.
    /// 2. **Single-pass validation** — amounts are validated in the same
    ///    iteration that performs transfers, avoiding a second loop.
    /// 3. **Cached storage accessor** — `env.storage().instance()` is obtained
    ///    once and reused for batch record + batch count writes.
    /// 4. **Batch records in persistent storage** — moves per-batch data out
    ///    of instance storage (which is loaded on every invocation) into
    ///    persistent storage, reducing base invocation cost.
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

        // Create the token client once, outside the loop.
        let token_client = token::Client::new(&env, &token);

        // Single-pass: validate amounts, accumulate total, and transfer
        // directly from sender to each recipient. This avoids:
        //   • A second iteration over the payments vector
        //   • The intermediate contract-address hop (sender→contract→recipient)
        //     which previously required N+1 transfer calls (1 bulk pull + N pushes).
        //     Now it is exactly N calls.
        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount <= 0 {
                return Err(ContractError::InvalidAmount);
            }
            total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
            // Transfer directly: sender → recipient (sender auth already checked)
            token_client.transfer(&sender, &op.recipient, &op.amount);
        }

        // ── Check account-level transaction limits ────────────────────────
        Self::check_limits(&env, &sender, total)?;

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &total);

        for op in payments.iter() {
            token_client.transfer(&env.current_contract_address(), &op.recipient, &op.amount);
        }

        // ── Record usage after successful execution ───────────────────────
        Self::record_usage(&env, &sender, total);

        // Write batch record to persistent storage (cheaper than instance for
        // historical data that does not need to be loaded on every invocation).
        let batch_id = Self::next_batch_id(&env);
        env.storage().persistent().set(&DataKey::Batch(batch_id), &BatchRecord {
        env.storage().temporary().set(&DataKey::Batch(batch_id), &BatchRecord {
            sender,
            token,
            total_sent: total,
            success_count: len,
            fail_count: 0,
            status: symbol_short!("completed"),
        });
        env.storage().temporary().extend_ttl(
            &DataKey::Batch(batch_id),
            TEMPORARY_TTL_THRESHOLD,
            TEMPORARY_TTL_EXTEND_TO,
        );

        for op in payments.iter() {
            if op.category == symbol_short!("bonus") {
                let mut total_bonuses: i128 = env.storage().instance().get(&DataKey::TotalBonusesPaid).unwrap_or(0);
                total_bonuses = total_bonuses.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
                env.storage().instance().set(&DataKey::TotalBonusesPaid, &total_bonuses);

                env.events().publish(
                    (symbol_short!("bonus"), op.category.clone(), op.recipient.clone()),
                    op.amount
                );
            } else {
                env.events().publish(
                    (symbol_short!("payment"), op.recipient.clone()),
                    op.amount
                );
            }
        }
        Ok(batch_id)
    }

    /// Gas-optimized best-effort batch payment.
    ///
    /// Optimizations vs. the original implementation:
    /// 1. **Single bulk pull, direct refund** — only one transfer into the
    ///    contract and at most one refund transfer back, instead of per-payment
    ///    accounting through the contract address.
    /// 2. **Cached contract address** — `env.current_contract_address()` is
    ///    called once and reused across all loop iterations.
    /// 3. **Batch records in persistent storage** — same benefit as above.
    /// 4. **Reduced cloning** — recipient addresses are only cloned for event
    ///    emission, not for transfer calls.
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

        // Pre-compute the total of all valid (positive) amounts in one pass.
        let mut total: i128 = 0;
        for op in payments.iter() {
            if op.amount > 0 {
                total = total.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
            }
        }

        // ── Check account-level transaction limits ────────────────────────
        Self::check_limits(&env, &sender, total)?;

        let token_client = token::Client::new(&env, &token);
        // Cache the contract address — avoids repeated cross-environment calls.
        let contract_addr = env.current_contract_address();
        // Single bulk pull from sender into the contract.
        token_client.transfer(&sender, &contract_addr, &total);

        let mut remaining = total;
        let mut success_count: u32 = 0;
        let mut fail_count: u32 = 0;
        let mut total_sent: i128 = 0;

        let batch_id = Self::next_batch_id(&env);
        for op in payments.iter() {
            if op.amount <= 0 || remaining < op.amount {
                fail_count += 1;
                PaymentSkippedEvent {
                    recipient: op.recipient.clone(),
                    amount: op.amount,
                };
                env.events().publish(
                    (symbol_short!("skipped"), op.recipient.clone()),
                    op.amount
                );
                continue;
            }
            token_client.transfer(&contract_addr, &op.recipient, &op.amount);
            remaining -= op.amount;
            total_sent += op.amount;
            success_count += 1;
            PaymentSentEvent {
                recipient: op.recipient.clone(),
                amount: op.amount,
            };

            if op.category == symbol_short!("bonus") {
                let mut total_bonuses: i128 = env.storage().instance().get(&DataKey::TotalBonusesPaid).unwrap_or(0);
                total_bonuses = total_bonuses.checked_add(op.amount).ok_or(ContractError::AmountOverflow)?;
                env.storage().instance().set(&DataKey::TotalBonusesPaid, &total_bonuses);

                env.events().publish(
                    (symbol_short!("bonus"), op.category.clone(), op.recipient.clone()),
                    op.amount
                );
            } else {
                env.events().publish(
                    (symbol_short!("payment"), op.recipient.clone()),
                    op.amount
                );
            }
        }

        // Single refund transfer if there is leftover.
        if remaining > 0 {
            token_client.transfer(&contract_addr, &sender, &remaining);
        }

        // ── Record usage for the amount actually sent ─────────────────────
        Self::record_usage(&env, &sender, total_sent);

        let status = if fail_count == 0 {
            symbol_short!("completed")
        } else if success_count == 0 {
            symbol_short!("rollbck")
        } else {
            symbol_short!("partial")
        };

        // Persistent storage for batch records.
        let batch_id = Self::next_batch_id(&env);
        env.storage().persistent().set(&DataKey::Batch(batch_id), &BatchRecord {
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
        // Read from persistent storage (optimized location for batch records).
        env.storage()
            .persistent()
            .get(&DataKey::Batch(batch_id))
            .ok_or(ContractError::BatchNotFound)
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
        let storage = env.storage().instance();
        let current: u64 = storage.get(&DataKey::Sequence).unwrap_or(0);
        if current != expected {
            return Err(ContractError::SequenceMismatch);
        }
        storage.set(&DataKey::Sequence, &(current + 1));
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
        let storage = env.storage().instance();
        let count: u64 = storage
            .get(&DataKey::BatchCount)
            .unwrap_or(0)
            + 1;
        storage.set(&DataKey::BatchCount, &count);
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

    /// Validate that limit values are non-negative.
    fn validate_limits(daily: i128, weekly: i128, monthly: i128) -> Result<(), ContractError> {
        if daily < 0 || weekly < 0 || monthly < 0 {
            return Err(ContractError::InvalidLimitConfig);
        }
        Ok(())
    }

    /// Return the effective limits for an account:
    /// per-account override > default limits > unlimited (all zeros).
    fn effective_limits(env: &Env, account: &Address) -> AccountLimits {
        // Check for per-account override first
        if let Some(limits) = env
            .storage()
            .persistent()
            .get::<DataKey, AccountLimits>(&DataKey::AcctLimits(account.clone()))
        {
            return limits;
        }
        // Fall back to default limits
        if let Some(limits) = env
            .storage()
            .instance()
            .get::<DataKey, AccountLimits>(&DataKey::DefaultLimits)
        {
            return limits;
        }
        // No limits configured → unlimited
        AccountLimits {
            daily_limit: 0,
            weekly_limit: 0,
            monthly_limit: 0,
        }
    }

    /// Return the current usage for an account, resetting any expired windows.
    fn current_usage(env: &Env, account: &Address) -> AccountUsage {
        let ledger = env.ledger().sequence();
        let mut usage: AccountUsage = env
            .storage()
            .persistent()
            .get(&DataKey::AcctUsage(account.clone()))
            .unwrap_or(AccountUsage {
                daily_spent: 0,
                daily_reset_ledger: ledger,
                weekly_spent: 0,
                weekly_reset_ledger: ledger,
                monthly_spent: 0,
                monthly_reset_ledger: ledger,
            });

        // Reset expired windows
        if ledger >= usage.daily_reset_ledger + LEDGERS_PER_DAY {
            usage.daily_spent = 0;
            usage.daily_reset_ledger = ledger;
        }
        if ledger >= usage.weekly_reset_ledger + LEDGERS_PER_WEEK {
            usage.weekly_spent = 0;
            usage.weekly_reset_ledger = ledger;
        }
        if ledger >= usage.monthly_reset_ledger + LEDGERS_PER_MONTH {
            usage.monthly_spent = 0;
            usage.monthly_reset_ledger = ledger;
        }

        usage
    }

    /// Check limits for an account before executing a batch.
    /// Emits a `TransactionBlockedEvent` and returns an error if any cap is exceeded.
    fn check_limits(env: &Env, account: &Address, amount: i128) -> Result<(), ContractError> {
        let limits = Self::effective_limits(env, account);
        let usage = Self::current_usage(env, account);

        // Daily check (0 means unlimited)
        if limits.daily_limit > 0 {
            let projected = usage.daily_spent + amount;
            if projected > limits.daily_limit {
                TransactionBlockedEvent {
                    account: account.clone(),
                    attempted_amount: amount,
                    limit_type: LimitTier::Daily,
                    current_usage: usage.daily_spent,
                    cap: limits.daily_limit,
                };
                return Err(ContractError::DailyLimitExceeded);
            }
        }

        // Weekly check
        if limits.weekly_limit > 0 {
            let projected = usage.weekly_spent + amount;
            if projected > limits.weekly_limit {
                TransactionBlockedEvent {
                    account: account.clone(),
                    attempted_amount: amount,
                    limit_type: LimitTier::Weekly,
                    current_usage: usage.weekly_spent,
                    cap: limits.weekly_limit,
                };
                return Err(ContractError::WeeklyLimitExceeded);
            }
        }

        // Monthly check
        if limits.monthly_limit > 0 {
            let projected = usage.monthly_spent + amount;
            if projected > limits.monthly_limit {
                TransactionBlockedEvent {
                    account: account.clone(),
                    attempted_amount: amount,
                    limit_type: LimitTier::Monthly,
                    current_usage: usage.monthly_spent,
                    cap: limits.monthly_limit,
                };
                return Err(ContractError::MonthlyLimitExceeded);
            }
        }

        Ok(())
    }

    /// Record cumulative spending for an account after a successful batch.
    fn record_usage(env: &Env, account: &Address, amount: i128) {
        let mut usage = Self::current_usage(env, account);
        usage.daily_spent += amount;
        usage.weekly_spent += amount;
        usage.monthly_spent += amount;
        env.storage()
            .persistent()
            .set(&DataKey::AcctUsage(account.clone()), &usage);
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