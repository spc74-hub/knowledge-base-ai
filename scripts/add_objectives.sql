-- =====================================================
-- OBJECTIVES - Sistema de Objetivos
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- =====================================================

-- Tabla principal de objetivos
CREATE TABLE IF NOT EXISTS public.objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Info basica
    title VARCHAR(200) NOT NULL,
    description TEXT,

    -- Temporalidad
    horizon VARCHAR(20) DEFAULT 'yearly',  -- daily, weekly, monthly, quarterly, yearly, lifetime
    target_date DATE,  -- deadline opcional

    -- Estado: future, pending, active, completed
    status VARCHAR(20) DEFAULT 'pending',

    -- Progreso calculado automaticamente (0-100)
    progress INTEGER DEFAULT 0,

    -- Visualizacion
    color VARCHAR(20) DEFAULT '#6366f1',
    icon VARCHAR(10) DEFAULT '🎯',

    -- Jerarquia (objetivos pueden tener sub-objetivos)
    parent_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
    position INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_objectives_user_id ON objectives(user_id);
CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives(status);
CREATE INDEX IF NOT EXISTS idx_objectives_parent ON objectives(parent_id);

-- RLS
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own objectives" ON objectives;
CREATE POLICY "Users can view own objectives"
    ON objectives FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own objectives" ON objectives;
CREATE POLICY "Users can insert own objectives"
    ON objectives FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own objectives" ON objectives;
CREATE POLICY "Users can update own objectives"
    ON objectives FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own objectives" ON objectives;
CREATE POLICY "Users can delete own objectives"
    ON objectives FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_objectives_updated_at ON objectives;
CREATE TRIGGER update_objectives_updated_at
    BEFORE UPDATE ON objectives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Acciones (tareas simples dentro de objetivos)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.objective_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Info
    title VARCHAR(300) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,

    -- Orden
    position INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_objective_actions_objective ON objective_actions(objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_actions_user ON objective_actions(user_id);

-- RLS
ALTER TABLE objective_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own objective_actions" ON objective_actions;
CREATE POLICY "Users can view own objective_actions"
    ON objective_actions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own objective_actions" ON objective_actions;
CREATE POLICY "Users can insert own objective_actions"
    ON objective_actions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own objective_actions" ON objective_actions;
CREATE POLICY "Users can update own objective_actions"
    ON objective_actions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own objective_actions" ON objective_actions;
CREATE POLICY "Users can delete own objective_actions"
    ON objective_actions FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- Relaciones: Objetivos <-> Modelos Mentales
-- =====================================================

CREATE TABLE IF NOT EXISTS public.objective_mental_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    mental_model_id UUID NOT NULL REFERENCES mental_models(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(objective_id, mental_model_id)
);

CREATE INDEX IF NOT EXISTS idx_objective_mm_objective ON objective_mental_models(objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_mm_model ON objective_mental_models(mental_model_id);

ALTER TABLE objective_mental_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own objective_mental_models" ON objective_mental_models;
CREATE POLICY "Users can manage own objective_mental_models"
    ON objective_mental_models FOR ALL
    USING (auth.uid() = user_id);

-- =====================================================
-- Relaciones: Objetivos <-> Proyectos
-- =====================================================

CREATE TABLE IF NOT EXISTS public.objective_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(objective_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_objective_projects_objective ON objective_projects(objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_projects_project ON objective_projects(project_id);

ALTER TABLE objective_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own objective_projects" ON objective_projects;
CREATE POLICY "Users can manage own objective_projects"
    ON objective_projects FOR ALL
    USING (auth.uid() = user_id);

-- =====================================================
-- Relaciones: Objetivos <-> Contenidos
-- =====================================================

CREATE TABLE IF NOT EXISTS public.objective_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(objective_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_objective_contents_objective ON objective_contents(objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_contents_content ON objective_contents(content_id);

ALTER TABLE objective_contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own objective_contents" ON objective_contents;
CREATE POLICY "Users can manage own objective_contents"
    ON objective_contents FOR ALL
    USING (auth.uid() = user_id);

-- =====================================================
-- Funcion para calcular progreso automatico
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_objective_progress(obj_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_actions INTEGER;
    completed_actions INTEGER;
    total_projects INTEGER;
    completed_projects INTEGER;
    actions_progress INTEGER := 0;
    projects_progress INTEGER := 0;
    final_progress INTEGER;
BEGIN
    -- Contar acciones
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed = TRUE)
    INTO total_actions, completed_actions
    FROM objective_actions
    WHERE objective_id = obj_id;

    IF total_actions > 0 THEN
        actions_progress := (completed_actions * 100) / total_actions;
    END IF;

    -- Contar proyectos completados
    SELECT COUNT(*), COUNT(*) FILTER (WHERE p.status = 'completed')
    INTO total_projects, completed_projects
    FROM objective_projects op
    JOIN projects p ON p.id = op.project_id
    WHERE op.objective_id = obj_id;

    IF total_projects > 0 THEN
        projects_progress := (completed_projects * 100) / total_projects;
    END IF;

    -- Calcular progreso final (promedio ponderado)
    IF total_actions > 0 AND total_projects > 0 THEN
        final_progress := (actions_progress + projects_progress) / 2;
    ELSIF total_actions > 0 THEN
        final_progress := actions_progress;
    ELSIF total_projects > 0 THEN
        final_progress := projects_progress;
    ELSE
        final_progress := 0;
    END IF;

    RETURN final_progress;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger para actualizar progreso cuando cambian acciones
-- =====================================================

CREATE OR REPLACE FUNCTION update_objective_progress()
RETURNS TRIGGER AS $$
DECLARE
    obj_id UUID;
    new_progress INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        obj_id := OLD.objective_id;
    ELSE
        obj_id := NEW.objective_id;
    END IF;

    new_progress := calculate_objective_progress(obj_id);

    UPDATE objectives
    SET progress = new_progress,
        status = CASE
            WHEN new_progress >= 100 THEN 'completed'
            ELSE status
        END,
        completed_at = CASE
            WHEN new_progress >= 100 AND completed_at IS NULL THEN NOW()
            ELSE completed_at
        END
    WHERE id = obj_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_objective_progress_actions ON objective_actions;
CREATE TRIGGER trigger_update_objective_progress_actions
    AFTER INSERT OR UPDATE OR DELETE ON objective_actions
    FOR EACH ROW EXECUTE FUNCTION update_objective_progress();

-- =====================================================
-- VERIFICACION
-- =====================================================

SELECT 'objectives created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'objectives';

SELECT 'objective_actions created' as status, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'objective_actions';

-- =====================================================
-- LISTO! Ejecuta en Supabase SQL Editor
-- =====================================================
