-- =====================================================
-- USER EXPERTS (GURUS) - Sistema de expertos personales
-- =====================================================
-- Permite marcar personas como expertos/gurús en categorías específicas

-- =====================================================
-- PASO 1: Tabla user_experts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_experts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Nombre de la persona (debe coincidir con entity de tipo person)
    person_name TEXT NOT NULL,

    -- Categorías en las que es experto (IAB categories, conceptos, etc.)
    expert_categories TEXT[] DEFAULT '{}',

    -- Metadata opcional
    description TEXT,
    notes TEXT,
    avatar_url TEXT,

    -- Flags
    is_active BOOLEAN DEFAULT TRUE,
    is_favorite BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: un usuario no puede tener el mismo experto duplicado
    CONSTRAINT unique_user_expert UNIQUE (user_id, person_name)
);

-- =====================================================
-- PASO 2: Índices
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_experts_user_id ON user_experts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_experts_person_name ON user_experts(person_name);
CREATE INDEX IF NOT EXISTS idx_user_experts_categories ON user_experts USING GIN(expert_categories);
CREATE INDEX IF NOT EXISTS idx_user_experts_active ON user_experts(is_active) WHERE is_active = TRUE;

-- =====================================================
-- PASO 3: Row Level Security
-- =====================================================
ALTER TABLE user_experts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own experts" ON user_experts;
CREATE POLICY "Users can manage own experts"
    ON user_experts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- PASO 4: Trigger updated_at
-- =====================================================
DROP TRIGGER IF EXISTS update_user_experts_updated_at ON user_experts;
CREATE TRIGGER update_user_experts_updated_at
    BEFORE UPDATE ON user_experts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PASO 5: Comentarios
-- =====================================================
COMMENT ON TABLE user_experts IS 'Personas marcadas como expertos/gurús por el usuario en categorías específicas';
COMMENT ON COLUMN user_experts.person_name IS 'Nombre de la persona (debe coincidir con entities.persons de contents)';
COMMENT ON COLUMN user_experts.expert_categories IS 'Categorías/temas en los que esta persona es considerada experta';
