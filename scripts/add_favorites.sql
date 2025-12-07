-- Add is_favorite column to objectives, projects, and mental_models tables
-- Run this in Supabase SQL Editor

-- Add is_favorite to objectives
ALTER TABLE objectives
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Add is_favorite to projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Add is_favorite to mental_models
ALTER TABLE mental_models
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Create indexes for faster favorite queries
CREATE INDEX IF NOT EXISTS idx_objectives_is_favorite ON objectives(user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_projects_is_favorite ON projects(user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_mental_models_is_favorite ON mental_models(user_id, is_favorite) WHERE is_favorite = TRUE;

-- Note: standalone_notes already uses is_pinned which serves the same purpose
-- contents already has is_favorite
