-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create employees table with full-text search support
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(56),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  position VARCHAR(100),
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(first_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(last_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(email, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(position, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(department, '')), 'C')
  ) STORED
);

-- Create transactions table with full-text search support
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  tx_hash VARCHAR(64) UNIQUE NOT NULL,
  amount DECIMAL(20, 7) NOT NULL,
  asset_code VARCHAR(12) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  transaction_type VARCHAR(20) DEFAULT 'payment' CHECK (transaction_type IN ('payment', 'refund', 'bonus')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(tx_hash, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(asset_code, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(status, '')), 'C')
  ) STORED
);

-- Create indexes for performance
CREATE INDEX idx_employees_org_id ON employees(organization_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_wallet ON employees(wallet_address);
CREATE INDEX idx_employees_search ON employees USING GIN(search_vector);
CREATE INDEX idx_employees_created_at ON employees(created_at);

CREATE INDEX idx_transactions_org_id ON transactions(organization_id);
CREATE INDEX idx_transactions_employee_id ON transactions(employee_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_transactions_search ON transactions USING GIN(search_vector);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_amount ON transactions(amount);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
