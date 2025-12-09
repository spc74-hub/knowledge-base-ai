-- =====================================================
-- Migrate view_count from metadata to dedicated column
-- For existing YouTube/TikTok content
-- =====================================================

-- Update YouTube content: extract view_count from metadata
UPDATE public.contents
SET view_count = (metadata->>'view_count')::bigint
WHERE type = 'youtube'
  AND metadata->>'view_count' IS NOT NULL
  AND view_count IS NULL;

-- Update TikTok content: extract view_count from metadata
UPDATE public.contents
SET view_count = (metadata->>'view_count')::bigint
WHERE type = 'tiktok'
  AND metadata->>'view_count' IS NOT NULL
  AND view_count IS NULL;

-- Also migrate description if not present
UPDATE public.contents
SET description = metadata->>'description'
WHERE type IN ('youtube', 'tiktok')
  AND metadata->>'description' IS NOT NULL
  AND description IS NULL;

-- Show results
SELECT type, COUNT(*) as total,
       COUNT(view_count) as with_view_count,
       COUNT(description) as with_description
FROM public.contents
WHERE type IN ('youtube', 'tiktok')
GROUP BY type;
