-- +goose Up
-- +goose StatementBegin

-- Create verification_token table with RLS (Row Level Security)
CREATE TABLE IF NOT EXISTS verification_token (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security on verification_token
ALTER TABLE verification_token ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant isolation
-- This ensures tenants can only access their own verification tokens via current_setting('app.current_tenant')
CREATE POLICY verification_token_tenant_isolation ON verification_token
    USING (tenant_id = current_setting('app.current_tenant', true)::integer);

-- Create indexes for performance
-- Composite index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_verification_token_tenant ON verification_token (tenant_id);
CREATE INDEX IF NOT EXISTS idx_verification_token_user ON verification_token (user_id);
CREATE INDEX IF NOT EXISTS idx_verification_token_token ON verification_token (token);

-- Add foreign key constraint to tenants table (with CASCADE to clean up when tenant is deleted)
ALTER TABLE verification_token
    ADD CONSTRAINT verification_token_tenant_id_fkey
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE CASCADE;

-- Add foreign key constraint to users table
ALTER TABLE verification_token
    ADD CONSTRAINT verification_token_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Drop foreign key constraints
ALTER TABLE verification_token DROP CONSTRAINT IF EXISTS verification_token_user_id_fkey;
ALTER TABLE verification_token DROP CONSTRAINT IF EXISTS verification_token_tenant_id_fkey;

-- Drop indexes
DROP INDEX IF EXISTS idx_verification_token_token;
DROP INDEX IF EXISTS idx_verification_token_user;
DROP INDEX IF EXISTS idx_verification_token_tenant;

-- Drop RLS policy
DROP POLICY IF EXISTS verification_token_tenant_isolation ON verification_token;

-- Disable and drop table
ALTER TABLE verification_token DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS verification_token;

-- +goose StatementEnd
