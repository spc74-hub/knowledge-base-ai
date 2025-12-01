-- Migration: Add vector embeddings support
-- Run this in Supabase SQL Editor

-- 1. Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to contents table
-- Using 1536 dimensions for OpenAI text-embedding-3-small
ALTER TABLE contents
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Create index for fast similarity search
CREATE INDEX IF NOT EXISTS contents_embedding_idx
ON contents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Create function for semantic search
CREATE OR REPLACE FUNCTION match_contents(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    summary text,
    url text,
    type text,
    iab_tier1 text,
    concepts text[],
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.title,
        c.summary,
        c.url,
        c.type,
        c.iab_tier1,
        c.concepts,
        1 - (c.embedding <=> query_embedding) as similarity
    FROM contents c
    WHERE
        c.embedding IS NOT NULL
        AND (p_user_id IS NULL OR c.user_id = p_user_id)
        AND 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 5. Create chat_sessions table if not exists
CREATE TABLE IF NOT EXISTS chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 6. Create chat_messages table if not exists
CREATE TABLE IF NOT EXISTS chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL,
    sources jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 7. Enable RLS on chat tables
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for chat_sessions
DROP POLICY IF EXISTS "Users can view own chat sessions" ON chat_sessions;
CREATE POLICY "Users can view own chat sessions" ON chat_sessions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own chat sessions" ON chat_sessions;
CREATE POLICY "Users can create own chat sessions" ON chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat sessions" ON chat_sessions;
CREATE POLICY "Users can delete own chat sessions" ON chat_sessions
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat sessions" ON chat_sessions;
CREATE POLICY "Users can update own chat sessions" ON chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- 9. Create RLS policies for chat_messages
DROP POLICY IF EXISTS "Users can view messages from own sessions" ON chat_messages;
CREATE POLICY "Users can view messages from own sessions" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create messages in own sessions" ON chat_messages;
CREATE POLICY "Users can create messages in own sessions" ON chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions
            WHERE chat_sessions.id = chat_messages.session_id
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- 10. Create indexes for chat tables
CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages(session_id);
