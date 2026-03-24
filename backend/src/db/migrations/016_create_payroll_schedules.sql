-- Create payroll_schedules table
CREATE TABLE IF NOT EXISTS payroll_schedules (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    time_of_day TIME NOT NULL,
    config JSONB NOT NULL, -- Stores the preferences/employee list
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payroll_schedules_org_id ON payroll_schedules(organization_id);
CREATE INDEX idx_payroll_schedules_next_run ON payroll_schedules(next_run_at) WHERE status = 'active';

CREATE TRIGGER update_payroll_schedules_updated_at BEFORE UPDATE ON payroll_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
