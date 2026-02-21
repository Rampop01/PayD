#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, token};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Payment(u64),
    PaymentCount,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentRecord {
    pub from: Address,
    pub amount: i128,
    pub asset: Address,
    pub receiver_id: String,
    pub target_asset: String,
    pub anchor_id: String,
    pub status: Symbol, // e.g. "pending", "completed", "failed"
}

#[contract]
pub struct CrossAssetPaymentContract;

#[contractimpl]
impl CrossAssetPaymentContract {
    /// Initialize the contract with an admin.
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PaymentCount, &0u64);
    }

    /// Initiate a cross-asset payment.
    pub fn initiate_payment(
        env: Env,
        from: Address,
        amount: i128,
        asset: Address,
        receiver_id: String,
        target_asset: String,
        anchor_id: String,
    ) -> u64 {
        from.require_auth();

        // Transfer funds from sender to this contract (escrow)
        let token_client = token::Client::new(&env, &asset);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        // Increment payment counter
        let mut count: u64 = env.storage().instance().get(&DataKey::PaymentCount).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::PaymentCount, &count);

        // Store the payment record
        let record = PaymentRecord {
            from,
            amount,
            asset,
            receiver_id,
            target_asset,
            anchor_id,
            status: symbol_short!("pending"),
        };

        env.storage().instance().set(&DataKey::Payment(count), &record);

        // Emit an event for backend/anchor tracking
        env.events().publish(
            (symbol_short!("pay_init"), count),
            record,
        );

        count
    }

    /// Update the status of a payment (Admin or Anchor authorized).
    pub fn update_status(env: Env, payment_id: u64, new_status: Symbol) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Not initialized");
        admin.require_auth();

        let mut record: PaymentRecord = env.storage().instance()
            .get(&DataKey::Payment(payment_id))
            .expect("Payment not found");

        record.status = new_status;
        env.storage().instance().set(&DataKey::Payment(payment_id), &record);

        env.events().publish(
            (symbol_short!("pay_upd"), payment_id),
            new_status,
        );
    }

    /// Get details of a payment.
    pub fn get_payment(env: Env, payment_id: u64) -> Option<PaymentRecord> {
        env.storage().instance().get(&DataKey::Payment(payment_id))
    }
}

mod test;
