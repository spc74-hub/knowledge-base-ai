-- =====================================================
-- Add view_count and description columns to contents table
-- For YouTube/TikTok popularity sorting and video descriptions
-- =====================================================

-- Add view_count column (for sorting by popularity)
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS view_count BIGINT DEFAULT NULL;

-- Add description column (for full video/content descriptions)
-- Separate from summary (AI-generated) - this is the original description
ALTER TABLE public.contents
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

-- Create index on view_count for efficient sorting
-- Use DESC NULLS LAST so content with views appears first
CREATE INDEX IF NOT EXISTS idx_contents_view_count
ON public.contents (view_count DESC NULLS LAST);

-- Composite index for user + view_count sorting
CREATE INDEX IF NOT EXISTS idx_contents_user_view_count
ON public.contents (user_id, view_count DESC NULLS LAST);

-- Comment on columns
COMMENT ON COLUMN public.contents.view_count IS 'Number of views (YouTube/TikTok) for popularity sorting';
COMMENT ON COLUMN public.contents.description IS 'Original description from source (YouTube/TikTok), distinct from AI summary';
