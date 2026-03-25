-- Webhook Subscriptions Table
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret_hash TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_url CHECK (url ~* '^https?://'),
    CONSTRAINT valid_events CHECK (array_length(events, 1) > 0)
);

-- Webhook Delivery Logs Table
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    request_headers JSONB,
    response_status_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    delivered_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Event Types Table (for tracking available events)
CREATE TABLE IF NOT EXISTS webhook_event_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    example_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_webhook_subscriptions_org ON webhook_subscriptions(organization_id);
CREATE INDEX idx_webhook_subscriptions_active ON webhook_subscriptions(is_active);
CREATE INDEX idx_webhook_delivery_logs_subscription ON webhook_delivery_logs(subscription_id);
CREATE INDEX idx_webhook_delivery_logs_status ON webhook_delivery_logs(status);
CREATE INDEX idx_webhook_delivery_logs_created ON webhook_delivery_logs(created_at DESC);
CREATE INDEX idx_webhook_delivery_logs_next_retry ON webhook_delivery_logs(next_retry_at) WHERE status IN ('pending', 'retrying');

-- Insert default event types
INSERT INTO webhook_event_types (name, description, category, example_payload) VALUES
('payroll.completed', 'Fired when a payroll run completes successfully', 'payroll', '{"payrollRunId": 123, "batchId": "batch_abc", "totalAmount": "10000.00", "employeeCount": 50}'),
('payroll.failed', 'Fired when a payroll run fails', 'payroll', '{"payrollRunId": 123, "batchId": "batch_abc", "errorMessage": "Insufficient funds", "failedCount": 5}'),
('payroll.started', 'Fired when a payroll run starts', 'payroll', '{"payrollRunId": 123, "batchId": "batch_abc", "scheduledDate": "2024-01-15"}'),
('employee.added', 'Fired when a new employee is added', 'employee', '{"employeeId": 456, "name": "John Doe", "email": "john@example.com", "position": "Developer"}'),
('employee.updated', 'Fired when an employee profile is updated', 'employee', '{"employeeId": 456, "changes": {"position": "Senior Developer"}, "updatedBy": "admin@example.com"}'),
('employee.removed', 'Fired when an employee is removed', 'employee', '{"employeeId": 456, "reason": "Termination", "removedBy": "admin@example.com"}'),
('balance.low', 'Fired when account balance falls below threshold', 'balance', '{"accountId": "GABC...", "currentBalance": "100.00", "threshold": "500.00", "assetCode": "USDC"}'),
('transaction.completed', 'Fired when a transaction is confirmed', 'transaction', '{"txHash": "abc123...", "amount": "1000.00", "assetCode": "USDC", "from": "GABC...", "to": "GDEF..."}'),
('transaction.failed', 'Fired when a transaction fails', 'transaction', '{"txHash": "abc123...", "errorMessage": "Insufficient balance", "amount": "1000.00"}'),
('contract.upgraded', 'Fired when a smart contract is upgraded', 'contract', '{"contractId": "CDemo...", "oldVersion": "1.0.0", "newVersion": "1.1.0", "upgradedBy": "admin@example.com"}'),
('multisig.created', 'Fired when a multi-signature setup is created', 'multisig', '{"configId": 789, "threshold": 2, "signers": ["GABC...", "GDEF..."]}'),
('multisig.executed', 'Fired when a multi-signature transaction is executed', 'multisig', '{"configId": 789, "txHash": "abc123...", "signers": ["GABC...", "GDEF..."]}')
ON CONFLICT (name) DO NOTHING;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_subscription_updated_at
    BEFORE UPDATE ON webhook_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_subscription_updated_at();
