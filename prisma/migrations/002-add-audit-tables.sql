-- +goose Up
-- +goose StatementBegin

-- Create audit_log table with RLS (Row Level Security)
-- Note: Using bigserial for BigInt compatibility with Prisma @id @default(autoincrement())
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security on audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant isolation
-- This ensures tenants can only access their own audit logs via current_setting('app.current_tenant')
CREATE POLICY audit_log_tenant_isolation ON audit_log
    USING (tenant_id = current_setting('app.current_tenant', true)::integer);

-- Create indexes for performance
-- Composite index for tenant-scoped queries sorted by creation time (most recent first)
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created ON audit_log (tenant_id, created_at DESC);

-- Index for filtering by event_type
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log (event_type);

-- Index for user-specific queries within a tenant
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_user ON audit_log (tenant_id, user_id);

-- Add foreign key constraint to tenants table (with CASCADE to clean up audit logs when tenant is deleted)
ALTER TABLE audit_log
    ADD CONSTRAINT audit_log_tenant_id_fkey
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE CASCADE;

-- Add foreign key constraint to users table (optional, user may be null for system events)
ALTER TABLE audit_log
    ADD CONSTRAINT audit_log_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Drop foreign key constraints
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_tenant_id_fkey;

-- Drop indexes
DROP INDEX IF EXISTS idx_audit_log_tenant_user;
DROP INDEX IF EXISTS idx_audit_log_event_type;
DROP INDEX IF EXISTS idx_audit_log_tenant_created;

-- Drop RLS policy
DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;

-- Disable and drop table
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS audit_log;

-- +goose StatementEnd
