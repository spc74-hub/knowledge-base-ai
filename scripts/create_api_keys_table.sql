-- Create user_api_keys table for permanent API tokens
CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Default API Key',
    key_hash VARCHAR(255) NOT NULL,  -- Store hashed version of the key
    key_prefix VARCHAR(10) NOT NULL,  -- First 8 chars for identification (kb_xxxxxxxx)
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT unique_key_hash UNIQUE (key_hash)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON user_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON user_api_keys(is_active) WHERE is_active = TRUE;

-- RLS policies
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their own API keys
CREATE POLICY "Users can view own API keys" ON user_api_keys
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own API keys
CREATE POLICY "Users can create own API keys" ON user_api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own API keys (for revoking)
CREATE POLICY "Users can update own API keys" ON user_api_keys
    FOR UPDATE USING (auth.uid() = user_id);

-- Service role can do everything (for API key validation)
CREATE POLICY "Service role full access" ON user_api_keys
    FOR ALL USING (auth.role() = 'service_role');
