-- =============================================================================
-- Migration 005: Add `is_triaged` flag to contents
-- =============================================================================
-- Strategic-layer refactor (CHANGELOG 2026-05-18 follow-up).
-- A capture from ContentHub is "triaged" once the user confirms its placement
-- in the PARA hierarchy (area / project / objective / mental_model). Pre-
-- assignment from the bridge counts as a SUGGESTION until confirmed manually.
--
-- Run from VPS:
--   docker exec -i spcapps-postgres psql -U spcadmin -d kbia \
--     < /opt/kbia/database/migrations/005_add_is_triaged.sql
-- =============================================================================

\set ON_ERROR_STOP on
BEGIN;

\echo '== Add column is_triaged (default false) =='
ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS is_triaged BOOLEAN NOT NULL DEFAULT FALSE;

\echo '== Backfill: anything Apple Notes / journal / native note = already triaged =='
-- Apple Notes are archival, not in the triage queue.
UPDATE contents
SET is_triaged = TRUE
WHERE type = 'note'
   OR url LIKE 'apple-notes://%'
   OR url LIKE 'journal://%'
   OR url LIKE 'note://%';

\echo '== Backfill: anything with PARA assignment = already triaged =='
UPDATE contents
SET is_triaged = TRUE
WHERE is_triaged = FALSE
  AND (
    area_id IS NOT NULL
    OR project_id IS NOT NULL
    OR id IN (SELECT content_id FROM objective_contents)
    OR id IN (SELECT content_id FROM content_mental_models)
  );

\echo '== Index for the inbox query (untriaged is the hot filter) =='
CREATE INDEX IF NOT EXISTS idx_contents_is_triaged
  ON contents(user_id, is_triaged)
  WHERE is_triaged = FALSE;

\echo '== Snapshot =='
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE is_triaged) AS triaged,
  COUNT(*) FILTER (WHERE NOT is_triaged) AS inbox
FROM contents;

\echo ''
\echo '== Review the snapshot. Type COMMIT; to apply or ROLLBACK; to abort. =='
