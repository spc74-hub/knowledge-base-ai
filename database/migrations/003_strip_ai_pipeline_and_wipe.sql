-- =============================================================================
-- Migration 003: Strip AI pipeline data + selective content wipe
-- =============================================================================
-- Apply MANUALLY via psql against the kbia DB on the VPS. There is no Alembic
-- runner wired into this project; deploys do NOT execute this file.
--
-- Run from VPS:
--   docker exec -i spcapps-postgres psql -U spcadmin -d kbia < 003_strip_ai_pipeline_and_wipe.sql
--
-- The whole script runs inside ONE transaction. Anything fails -> rollback.
-- Inspect each step's output before COMMIT (kept explicit at the end).
-- =============================================================================

\set ON_ERROR_STOP on
BEGIN;

-- -----------------------------------------------------------------------------
-- Step 0: snapshot counts (so you can verify after)
-- -----------------------------------------------------------------------------
\echo '== Step 0: snapshot before =='
SELECT 'contents_total' AS metric, COUNT(*) AS value FROM contents
UNION ALL
SELECT 'contents_note', COUNT(*) FROM contents WHERE type = 'note'
UNION ALL
SELECT 'contents_to_delete', COUNT(*) FROM contents
  WHERE type IN ('tiktok','youtube','web','twitter','pdf','email','docx','audio','podcast')
UNION ALL
SELECT 'contents_with_project_id_to_delete', COUNT(*) FROM contents
  WHERE project_id IS NOT NULL
    AND type IN ('tiktok','youtube','web','twitter','pdf','email','docx','audio','podcast');

-- IMPORTANT: review the row above. If `contents_with_project_id_to_delete` > 0
-- and you want to KEEP those rows, ROLLBACK now and update them manually first:
--   SELECT id, title, project_id, type FROM contents WHERE project_id IS NOT NULL AND type != 'note';
-- Then either re-type them ('note') or unlink:
--   UPDATE contents SET project_id = NULL WHERE id = '...';

-- -----------------------------------------------------------------------------
-- Step 1: capture the set of content IDs that will be deleted
-- -----------------------------------------------------------------------------
\echo '== Step 1: stash IDs to delete =='
CREATE TEMP TABLE _contents_to_delete ON COMMIT DROP AS
SELECT id FROM contents
WHERE type IN ('tiktok','youtube','web','twitter','pdf','email','docx','audio','podcast');

SELECT COUNT(*) AS ids_to_delete FROM _contents_to_delete;

-- -----------------------------------------------------------------------------
-- Step 2: clean up junction tables + array refs (NO FK constraints in this DB,
-- so cascades won't happen; we delete dependents explicitly).
-- -----------------------------------------------------------------------------
\echo '== Step 2: cleanup junctions and array refs =='

-- objective_contents: linked content IDs in junction
DELETE FROM objective_contents
WHERE content_id IN (SELECT id FROM _contents_to_delete);

-- content_mental_models: linked content IDs in junction
DELETE FROM content_mental_models
WHERE content_id IN (SELECT id FROM _contents_to_delete);

-- standalone_notes.source_content_id: nullable FK-style ref
UPDATE standalone_notes
SET source_content_id = NULL
WHERE source_content_id IN (SELECT id FROM _contents_to_delete);

-- standalone_notes.linked_content_ids: text[] of content IDs (cast to text)
UPDATE standalone_notes
SET linked_content_ids = ARRAY(
    SELECT cid
    FROM unnest(linked_content_ids) AS cid
    WHERE cid NOT IN (SELECT id::text FROM _contents_to_delete)
)
WHERE linked_content_ids && ARRAY(SELECT id::text FROM _contents_to_delete);

-- -----------------------------------------------------------------------------
-- Step 3: actual wipe of contents
-- -----------------------------------------------------------------------------
\echo '== Step 3: DELETE contents =='
DELETE FROM contents
WHERE type IN ('tiktok','youtube','web','twitter','pdf','email','docx','audio','podcast');

-- -----------------------------------------------------------------------------
-- Step 4: drop chat tables (AI pipeline removed in commit 0b76114)
-- -----------------------------------------------------------------------------
\echo '== Step 4: drop chat tables =='
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;

-- -----------------------------------------------------------------------------
-- Step 5: snapshot counts (after)
-- -----------------------------------------------------------------------------
\echo '== Step 5: snapshot after =='
SELECT 'contents_total_after' AS metric, COUNT(*) AS value FROM contents
UNION ALL
SELECT 'contents_note_after', COUNT(*) FROM contents WHERE type = 'note'
UNION ALL
SELECT 'contents_bridge_after',
       COUNT(*) FROM contents WHERE source_metadata->>'origin' = 'contenthub_bridge';

-- -----------------------------------------------------------------------------
-- Phase 3b (commented OUT — do NOT apply yet).
-- search.py still reads these columns. Apply only AFTER the search.py rewrite
-- is deployed.
-- -----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_contents_embedding_ivfflat;
-- DROP INDEX IF EXISTS idx_contents_search_vector;
-- DROP INDEX IF EXISTS idx_contents_concepts;
-- DROP INDEX IF EXISTS idx_contents_entities;
-- DROP INDEX IF EXISTS idx_contents_iab_tier1;
-- DROP INDEX IF EXISTS idx_contents_schema_type;
-- DROP INDEX IF EXISTS idx_contents_language;
-- DROP INDEX IF EXISTS idx_contents_processing_status;
-- ALTER TABLE contents
--   DROP COLUMN IF EXISTS embedding,
--   DROP COLUMN IF EXISTS raw_content,
--   DROP COLUMN IF EXISTS concepts,
--   DROP COLUMN IF EXISTS entities,
--   DROP COLUMN IF EXISTS user_entities,
--   DROP COLUMN IF EXISTS user_concepts,
--   DROP COLUMN IF EXISTS iab_tier1,
--   DROP COLUMN IF EXISTS iab_tier2,
--   DROP COLUMN IF EXISTS iab_tier3,
--   DROP COLUMN IF EXISTS schema_type,
--   DROP COLUMN IF EXISTS schema_subtype,
--   DROP COLUMN IF EXISTS sentiment,
--   DROP COLUMN IF EXISTS technical_level,
--   DROP COLUMN IF EXISTS content_format,
--   DROP COLUMN IF EXISTS reading_time_minutes,
--   DROP COLUMN IF EXISTS language,
--   DROP COLUMN IF EXISTS maturity_level,
--   DROP COLUMN IF EXISTS processed_at,
--   DROP COLUMN IF EXISTS last_reviewed_at,
--   DROP COLUMN IF EXISTS processing_status,
--   DROP COLUMN IF EXISTS processing_error;

-- =============================================================================
-- Inspect the output of Step 0 vs Step 5. If satisfied:
--   COMMIT;
-- If anything looks off:
--   ROLLBACK;
-- =============================================================================
\echo ''
\echo '== Review the snapshots above. Type COMMIT; to apply or ROLLBACK; to abort. =='
