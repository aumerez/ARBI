-- Migration: 001-init-schema
-- Description: Initial database schema with RLS policies for multi-tenancy
-- Created: 2025-03-09

-- Explicitly set the search path to public
SET search_path TO public;

-- ============================================
-- PHASE 1: Create tables with proper FK ordering
-- ============================================

-- Tenant table MUST be first (all other tables reference it)
CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "plan" VARCHAR(50),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users table (references Tenant)
CREATE TABLE IF NOT EXISTS "User" (
  "id" SERIAL PRIMARY KEY,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "password_hash" VARCHAR(255) NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "email_verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Documents table (references Tenant and User)
CREATE TABLE IF NOT EXISTS "Document" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "filename" VARCHAR(500) NOT NULL,
  "mimetype" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
  "error_message" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- DocumentChunks table (references Tenant and Document)
CREATE TABLE IF NOT EXISTS "DocumentChunk" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "document_id" INTEGER NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "token_count" INTEGER NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Chats table (references Tenant and User)
CREATE TABLE IF NOT EXISTS "Chat" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "title" VARCHAR(500),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ChatMessages table (references Tenant and Chat)
CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "chat_id" INTEGER NOT NULL,
  "role" VARCHAR(20) NOT NULL,
  "content" TEXT NOT NULL,
  "citations" JSONB,
  "retrieved_chunk_ids" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RefreshTokens table (references Tenant and User)
CREATE TABLE IF NOT EXISTS "RefreshToken" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "token_hash" VARCHAR(255) NOT NULL UNIQUE,
  "expires_at" TIMESTAMP NOT NULL,
  "revoked" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PasswordResetTokens table (references Tenant and User)
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "token_hash" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- AuditLogs table (references Tenant, optional User)
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" BIGSERIAL PRIMARY KEY,
  "tenant_id" INTEGER NOT NULL,
  "user_id" INTEGER,
  "event_type" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL,
  "ip_address" VARCHAR(45),
  "user_agent" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- PHASE 2: Add foreign key constraints with ON DELETE CASCADE
-- ============================================

-- User foreign keys
ALTER TABLE "User"
  ADD CONSTRAINT "User_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE CASCADE;

-- Document foreign keys
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Document_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE;

-- DocumentChunk foreign keys
ALTER TABLE "DocumentChunk"
  ADD CONSTRAINT "DocumentChunk_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "DocumentChunk_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "Document" ("id") ON DELETE CASCADE;

-- Chat foreign keys
ALTER TABLE "Chat"
  ADD CONSTRAINT "Chat_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Chat_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE;

-- ChatMessage foreign keys
ALTER TABLE "ChatMessage"
  ADD CONSTRAINT "ChatMessage_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "ChatMessage_chat_id_fkey"
  FOREIGN KEY ("chat_id") REFERENCES "Chat" ("id") ON DELETE CASCADE;

-- RefreshToken foreign keys
ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "RefreshToken_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE;

-- PasswordResetToken foreign keys
ALTER TABLE "PasswordResetToken"
  ADD CONSTRAINT "PasswordResetToken_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "PasswordResetToken_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE;

-- AuditLog foreign keys
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "AuditLog_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL;

-- ============================================
-- PHASE 3: Enable Row Level Security on all tenant-scoped tables
-- ============================================

-- 8 tenant-scoped tables (exclude Tenant table itself from RLS)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentChunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Chat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PHASE 4: Create RLS policies for tenant isolation
-- ============================================

-- Policy naming: tenant_isolation_<table>

CREATE POLICY tenant_isolation_users ON "User"
  USING ("tenant_id" = current_setting('app.current_tenant')::integer);

CREATE POLICY tenant_isolation_documents ON "Document"
  USING ("tenant_id" = current_setting('app.current_tenant')::integer);

CREATE POLICY tenant_isolation_document_chunks ON "DocumentChunk"
  USING ("tenant_id" = current_setting('app.current_tenant')::integer);

CREATE POLICY tenant_isolation_chats ON "Chat"
  USING ("tenant_id" = current_setting('app.current_tenant')::integer);

CREATE POLICY tenant_isolation_chat_messages ON "ChatMessage"
  USING ("tenant_id" = current_setting('app.current_tenant')::integer);

CREATE POLICY tenant_isolation_refresh_tokens ON "RefreshToken"
  USING ("tenant_id" = current_setting('app.current_tenant')::integer);

CREATE POLICY tenant_isolation_password_reset_tokens ON "PasswordResetToken"
  USING ("tenant_id" = current_setting('app.current_tenant')::integer);

CREATE POLICY tenant_isolation_audit_logs ON "AuditLog"
  USING ("tenant_id" = current_setting('app.current_tenant')::integer);

-- ============================================
-- PHASE 5: Create application role and grant privileges
-- ============================================

-- Create role 'app' if it doesn't exist (PostgreSQL 14 compatible)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app;
  END IF;
END
$$;

-- Grant full DML privileges on all tables to app role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;

-- Note: The application should connect as a superuser or a user with
-- sufficient privileges to SET the app.current_tenant GUC and perform
-- operations under RLS. The 'app' role can be granted to that user.
