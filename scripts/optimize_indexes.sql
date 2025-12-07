-- =====================================================
-- OPTIMIZATION INDEXES - Knowledge Base AI
-- =====================================================
-- Execute in Supabase SQL Editor
-- These indexes optimize common query patterns
-- =====================================================

-- =====================================================
-- CONTENTS TABLE INDEXES
-- =====================================================

-- Composite index for explorer with common filters
CREATE INDEX IF NOT EXISTS idx_contents_explorer_main
ON contents(user_id, processing_status, created_at DESC);

-- Composite index for type + category filtering
CREATE INDEX IF NOT EXISTS idx_contents_type_category
ON contents(user_id, type, schema_type, created_at DESC);

-- Composite index for IAB taxonomy browsing
CREATE INDEX IF NOT EXISTS idx_contents_iab_taxonomy
ON contents(user_id, iab_tier1, iab_tier2, created_at DESC);

-- Partial index for favorites (only indexes favorites=true)
CREATE INDEX IF NOT EXISTS idx_contents_favorites_only
ON contents(user_id, created_at DESC)
WHERE is_favorite = true;

-- Partial index for archived items
CREATE INDEX IF NOT EXISTS idx_contents_archived_only
ON contents(user_id, created_at DESC)
WHERE is_archived = true;

-- Partial index for pending processing
CREATE INDEX IF NOT EXISTS idx_contents_pending_processing
ON contents(user_id, created_at DESC)
WHERE processing_status = 'pending';

-- Index for project content linking
CREATE INDEX IF NOT EXISTS idx_contents_project_id
ON contents(project_id, user_id, created_at DESC);

-- Index for maturity level filtering
CREATE INDEX IF NOT EXISTS idx_contents_maturity
ON contents(user_id, maturity_level, created_at DESC);

-- =====================================================
-- STANDALONE NOTES TABLE INDEXES
-- =====================================================

-- Index for notes by source content (already created but ensure it exists)
CREATE INDEX IF NOT EXISTS idx_standalone_notes_source_content_id
ON standalone_notes(source_content_id);

-- Composite index for notes listing with filters
CREATE INDEX IF NOT EXISTS idx_standalone_notes_listing
ON standalone_notes(user_id, note_type, is_pinned DESC, created_at DESC);

-- =====================================================
-- CONTENT_MENTAL_MODELS TABLE INDEXES
-- =====================================================

-- Index for looking up models by content
CREATE INDEX IF NOT EXISTS idx_content_mental_models_content
ON content_mental_models(content_id);

-- Index for looking up contents by model
CREATE INDEX IF NOT EXISTS idx_content_mental_models_model
ON content_mental_models(mental_model_id);

-- =====================================================
-- CHAT TABLES INDEXES
-- =====================================================

-- Index for chat messages by session
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
ON chat_messages(session_id, created_at DESC);

-- =====================================================
-- PROJECTS TABLE INDEXES
-- =====================================================

-- Index for user's projects listing
CREATE INDEX IF NOT EXISTS idx_projects_user_listing
ON projects(user_id, status, updated_at DESC);

-- =====================================================
-- MENTAL MODELS TABLE INDEXES
-- =====================================================

-- Index for user's mental models
CREATE INDEX IF NOT EXISTS idx_mental_models_user_active
ON mental_models(user_id, is_active, name);

-- =====================================================
-- ANALYZE TABLES (Update statistics for query planner)
-- =====================================================
ANALYZE contents;
ANALYZE standalone_notes;
ANALYZE content_mental_models;
ANALYZE chat_messages;
ANALYZE projects;
ANALYZE mental_models;

-- =====================================================
-- VERIFICATION - Check created indexes
-- =====================================================
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('contents', 'standalone_notes', 'content_mental_models', 'projects', 'mental_models')
ORDER BY tablename, indexname;
