-- Migration: Add full-text search capability to DocumentChunk
-- Creates tsvector column for BM25 ranking and GIN index for performance

-- Add generated tsvector column for full-text search
-- Uses English text search configuration
ALTER TABLE "DocumentChunk"
ADD COLUMN content_tsv tsvector
GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;

-- Create GIN index for efficient full-text search queries
CREATE INDEX document_chunk_content_tsv_idx
ON "DocumentChunk"
USING GIN (content_tsv);

-- Also add an index on tenant_id for better filtering (if not exists)
-- This supports the hybrid search queries that filter by tenant
CREATE INDEX IF NOT EXISTS document_chunk_tenant_id_idx
ON "DocumentChunk" (tenant_id);
