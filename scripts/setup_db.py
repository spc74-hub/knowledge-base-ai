#!/usr/bin/env python3
"""
Database setup script.
Creates tables and enables extensions in Supabase.
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment")
    sys.exit(1)

# SQL to create tables
CREATE_TABLES_SQL = """
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create contents table
CREATE TABLE IF NOT EXISTS public.contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'web',
    schema_type VARCHAR(100),
    schema_subtype VARCHAR(100),
    iab_tier1 VARCHAR(100),
    iab_tier2 VARCHAR(200),
    iab_tier3 VARCHAR(200),
    title TEXT NOT NULL,
    summary TEXT,
    raw_content TEXT,
    concepts TEXT[] DEFAULT '{}',
    entities JSONB DEFAULT '{}',
    language VARCHAR(10) DEFAULT 'es',
    sentiment VARCHAR(20),
    technical_level VARCHAR(30),
    content_format VARCHAR(50),
    reading_time_minutes INTEGER,
    user_tags TEXT[] DEFAULT '{}',
    is_favorite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(20) DEFAULT 'pending',
    processing_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_type CHECK (type IN ('web', 'youtube', 'tiktok', 'twitter', 'pdf', 'note')),
    CONSTRAINT unique_user_url UNIQUE (user_id, url)
);

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]',
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'system'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contents_user_id ON contents(user_id);
CREATE INDEX IF NOT EXISTS idx_contents_type ON contents(type);
CREATE INDEX IF NOT EXISTS idx_contents_created_at ON contents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contents_iab_tier1 ON contents(iab_tier1);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

-- Enable RLS
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view own contents" ON contents;
CREATE POLICY "Users can view own contents" ON contents FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own contents" ON contents;
CREATE POLICY "Users can insert own contents" ON contents FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own contents" ON contents;
CREATE POLICY "Users can update own contents" ON contents FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own contents" ON contents;
CREATE POLICY "Users can delete own contents" ON contents FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own sessions" ON chat_sessions;
CREATE POLICY "Users can manage own sessions" ON chat_sessions FOR ALL USING (auth.uid() = user_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_contents_updated_at ON contents;
CREATE TRIGGER update_contents_updated_at
    BEFORE UPDATE ON contents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
"""


def main():
    print("Connecting to Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("Setting up database...")

    # Note: Supabase Python client doesn't support raw SQL directly
    # You need to run this SQL in the Supabase SQL Editor
    print("\n" + "=" * 60)
    print("IMPORTANT: Copy the following SQL and run it in")
    print("Supabase Dashboard > SQL Editor")
    print("=" * 60 + "\n")
    print(CREATE_TABLES_SQL)
    print("\n" + "=" * 60)
    print("After running the SQL, the database will be ready.")
    print("=" * 60)


if __name__ == "__main__":
    main()
