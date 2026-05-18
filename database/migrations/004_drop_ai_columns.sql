-- =============================================================================
-- Migration 004: Drop AI metadata columns from contents
-- =============================================================================
-- Run AFTER deploying the matching backend code (commit referenced in CHANGELOG
-- 2026-05-18 / Fix 3.d). The Python code no longer reads or writes any of these
-- columns; this migration physically removes them and their indexes.
--
-- Run from VPS:
--   docker exec -i spcapps-postgres psql -U spcadmin -d kbia \
--     < /opt/kbia/database/migrations/004_drop_ai_columns.sql
--
-- The script runs in a single transaction. Inspect the column list before /
-- after and approve the COMMIT at the end.
-- =============================================================================

\set ON_ERROR_STOP on
BEGIN;

\echo '== Before: AI columns still present =='
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'contents'
  AND column_name IN (
    'embedding', 'raw_content', 'concepts', 'entities', 'user_entities',
    'user_concepts', 'iab_tier1', 'iab_tier2', 'iab_tier3', 'schema_type',
    'schema_subtype', 'sentiment', 'technical_level', 'content_format',
    'reading_time_minutes', 'language', 'maturity_level', 'processed_at',
    'last_reviewed_at', 'processing_status', 'processing_error'
  )
ORDER BY column_name;

-- -----------------------------------------------------------------------------
-- Drop indexes that reference columns we're about to drop.
-- IF EXISTS so this migration is idempotent.
-- -----------------------------------------------------------------------------
\echo '== Dropping indexes that reference AI columns =='
DROP INDEX IF EXISTS idx_contents_embedding_ivfflat;
DROP INDEX IF EXISTS idx_contents_embedding_hnsw;
DROP INDEX IF EXISTS idx_contents_search_vector;
DROP INDEX IF EXISTS idx_contents_concepts;
DROP INDEX IF EXISTS idx_contents_entities;
DROP INDEX IF EXISTS idx_contents_entities_persons;
DROP INDEX IF EXISTS idx_contents_entities_orgs;
DROP INDEX IF EXISTS idx_contents_iab_tier1;
DROP INDEX IF EXISTS idx_contents_schema_type;
DROP INDEX IF EXISTS idx_contents_language;
DROP INDEX IF EXISTS idx_contents_processing_status;
DROP INDEX IF EXISTS idx_contents_user_entities;
DROP INDEX IF EXISTS idx_contents_user_concepts;

-- -----------------------------------------------------------------------------
-- Drop the columns themselves. CASCADE to also drop any dependent views,
-- triggers, or auto-generated tsvector columns.
-- -----------------------------------------------------------------------------
\echo '== Dropping AI columns =='
ALTER TABLE contents
  DROP COLUMN IF EXISTS embedding CASCADE,
  DROP COLUMN IF EXISTS raw_content CASCADE,
  DROP COLUMN IF EXISTS concepts CASCADE,
  DROP COLUMN IF EXISTS entities CASCADE,
  DROP COLUMN IF EXISTS user_entities CASCADE,
  DROP COLUMN IF EXISTS user_concepts CASCADE,
  DROP COLUMN IF EXISTS iab_tier1 CASCADE,
  DROP COLUMN IF EXISTS iab_tier2 CASCADE,
  DROP COLUMN IF EXISTS iab_tier3 CASCADE,
  DROP COLUMN IF EXISTS schema_type CASCADE,
  DROP COLUMN IF EXISTS schema_subtype CASCADE,
  DROP COLUMN IF EXISTS sentiment CASCADE,
  DROP COLUMN IF EXISTS technical_level CASCADE,
  DROP COLUMN IF EXISTS content_format CASCADE,
  DROP COLUMN IF EXISTS reading_time_minutes CASCADE,
  DROP COLUMN IF EXISTS language CASCADE,
  DROP COLUMN IF EXISTS maturity_level CASCADE,
  DROP COLUMN IF EXISTS processed_at CASCADE,
  DROP COLUMN IF EXISTS last_reviewed_at CASCADE,
  DROP COLUMN IF EXISTS processing_status CASCADE,
  DROP COLUMN IF EXISTS processing_error CASCADE,
  DROP COLUMN IF EXISTS search_vector CASCADE;

\echo '== After: columns that survive =='
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'contents'
ORDER BY ordinal_position;

\echo ''
\echo '== Review the column list above. Type COMMIT; to apply, ROLLBACK; to abort. =='
