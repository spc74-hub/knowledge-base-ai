-- =====================================================
-- MIGRATION: Areas of Responsibility & Habits System
-- =====================================================
-- Execute in Supabase SQL Editor
-- This creates the full structure for Areas and Habits
-- =====================================================

-- =====================================================
-- PART 1: AREAS OF RESPONSIBILITY
-- =====================================================

-- Main areas table
CREATE TABLE IF NOT EXISTS areas_of_responsibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📋',
    color TEXT DEFAULT '#6366f1',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sub-areas table (independent entities under areas)
CREATE TABLE IF NOT EXISTS sub_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES areas_of_responsibility(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📌',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Many-to-many: Areas <-> Mental Models
CREATE TABLE IF NOT EXISTS area_mental_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES areas_of_responsibility(id) ON DELETE CASCADE,
    mental_model_id UUID NOT NULL REFERENCES mental_models(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(area_id, mental_model_id)
);

-- Add area_id to existing tables
ALTER TABLE objectives
ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas_of_responsibility(id) ON DELETE SET NULL;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas_of_responsibility(id) ON DELETE SET NULL;

ALTER TABLE contents
ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas_of_responsibility(id) ON DELETE SET NULL;

ALTER TABLE standalone_notes
ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas_of_responsibility(id) ON DELETE SET NULL;

-- Indexes for areas
CREATE INDEX IF NOT EXISTS idx_areas_user_status ON areas_of_responsibility(user_id, status, display_order);
CREATE INDEX IF NOT EXISTS idx_sub_areas_area ON sub_areas(area_id, display_order);
CREATE INDEX IF NOT EXISTS idx_area_mental_models_area ON area_mental_models(area_id);
CREATE INDEX IF NOT EXISTS idx_area_mental_models_model ON area_mental_models(mental_model_id);
CREATE INDEX IF NOT EXISTS idx_objectives_area ON objectives(area_id);
CREATE INDEX IF NOT EXISTS idx_projects_area ON projects(area_id);
CREATE INDEX IF NOT EXISTS idx_contents_area ON contents(area_id);
CREATE INDEX IF NOT EXISTS idx_standalone_notes_area ON standalone_notes(area_id);

-- RLS Policies for areas_of_responsibility
ALTER TABLE areas_of_responsibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own areas" ON areas_of_responsibility
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own areas" ON areas_of_responsibility
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own areas" ON areas_of_responsibility
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own areas" ON areas_of_responsibility
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sub_areas
ALTER TABLE sub_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sub_areas" ON sub_areas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sub_areas" ON sub_areas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sub_areas" ON sub_areas
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sub_areas" ON sub_areas
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for area_mental_models
ALTER TABLE area_mental_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own area_mental_models" ON area_mental_models
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM areas_of_responsibility WHERE id = area_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can create own area_mental_models" ON area_mental_models
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM areas_of_responsibility WHERE id = area_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can delete own area_mental_models" ON area_mental_models
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM areas_of_responsibility WHERE id = area_id AND user_id = auth.uid())
    );

-- =====================================================
-- PART 2: HABITS SYSTEM
-- =====================================================

-- Main habits table
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '✅',
    color TEXT DEFAULT '#10b981',

    -- Frequency configuration
    frequency_type TEXT NOT NULL DEFAULT 'daily' CHECK (frequency_type IN ('daily', 'weekly', 'monthly', 'custom')),
    frequency_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,0], -- 0=Sunday, 1=Monday, etc.
    target_count INTEGER DEFAULT 1, -- times per period (e.g., 3 times/week)

    -- Time settings
    target_time TIME, -- optional target time
    reminder_enabled BOOLEAN DEFAULT false,
    reminder_time TIME,

    -- Relationships (optional)
    area_id UUID REFERENCES areas_of_responsibility(id) ON DELETE SET NULL,
    objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,

    -- Status
    is_active BOOLEAN DEFAULT true,
    archived_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habit completion logs
CREATE TABLE IF NOT EXISTS habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'skipped', 'partial', 'missed')),
    value INTEGER DEFAULT 1, -- for countable habits (e.g., glasses of water)
    notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: one log per habit per day
    UNIQUE(habit_id, date)
);

-- Indexes for habits
CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_habits_area ON habits(area_id) WHERE area_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_habits_objective ON habits(objective_id) WHERE objective_id IS NOT NULL;

-- Indexes for habit_logs (critical for performance)
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs(habit_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date_status ON habit_logs(date, status);

-- RLS Policies for habits
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habits" ON habits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own habits" ON habits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habits" ON habits
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own habits" ON habits
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for habit_logs
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own habit_logs" ON habit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own habit_logs" ON habit_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habit_logs" ON habit_logs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own habit_logs" ON habit_logs
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- PART 3: HELPER FUNCTIONS
-- =====================================================

-- Function to calculate current streak for a habit
CREATE OR REPLACE FUNCTION get_habit_streak(p_habit_id UUID)
RETURNS INTEGER AS $$
DECLARE
    streak INTEGER := 0;
    check_date DATE := CURRENT_DATE;
    habit_record RECORD;
    log_exists BOOLEAN;
BEGIN
    -- Get habit frequency info
    SELECT frequency_type, frequency_days INTO habit_record
    FROM habits WHERE id = p_habit_id;

    -- Loop backwards from today
    LOOP
        -- Check if this day should be counted based on frequency
        IF habit_record.frequency_type = 'daily' OR
           (habit_record.frequency_type IN ('weekly', 'custom') AND
            EXTRACT(DOW FROM check_date)::INTEGER = ANY(habit_record.frequency_days)) THEN

            -- Check if completed on this day
            SELECT EXISTS(
                SELECT 1 FROM habit_logs
                WHERE habit_id = p_habit_id
                AND date = check_date
                AND status = 'completed'
            ) INTO log_exists;

            IF log_exists THEN
                streak := streak + 1;
            ELSE
                -- If today and not completed yet, continue checking
                IF check_date = CURRENT_DATE THEN
                    check_date := check_date - 1;
                    CONTINUE;
                END IF;
                EXIT;
            END IF;
        END IF;

        check_date := check_date - 1;

        -- Safety limit
        IF check_date < CURRENT_DATE - 365 THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN streak;
END;
$$ LANGUAGE plpgsql;

-- Function to get best streak ever for a habit
CREATE OR REPLACE FUNCTION get_habit_best_streak(p_habit_id UUID)
RETURNS INTEGER AS $$
DECLARE
    best_streak INTEGER := 0;
    current_streak INTEGER := 0;
    prev_date DATE;
    log_record RECORD;
    habit_record RECORD;
BEGIN
    SELECT frequency_type, frequency_days INTO habit_record
    FROM habits WHERE id = p_habit_id;

    FOR log_record IN
        SELECT date FROM habit_logs
        WHERE habit_id = p_habit_id AND status = 'completed'
        ORDER BY date ASC
    LOOP
        IF prev_date IS NULL OR
           (log_record.date - prev_date <= 1) OR
           (habit_record.frequency_type = 'weekly' AND log_record.date - prev_date <= 7) THEN
            current_streak := current_streak + 1;
        ELSE
            IF current_streak > best_streak THEN
                best_streak := current_streak;
            END IF;
            current_streak := 1;
        END IF;
        prev_date := log_record.date;
    END LOOP;

    IF current_streak > best_streak THEN
        best_streak := current_streak;
    END IF;

    RETURN best_streak;
END;
$$ LANGUAGE plpgsql;

-- Function to get completion rate for a habit in a date range
CREATE OR REPLACE FUNCTION get_habit_completion_rate(
    p_habit_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS NUMERIC AS $$
DECLARE
    total_days INTEGER := 0;
    completed_days INTEGER := 0;
    check_date DATE;
    habit_record RECORD;
BEGIN
    SELECT frequency_type, frequency_days INTO habit_record
    FROM habits WHERE id = p_habit_id;

    check_date := p_start_date;

    WHILE check_date <= p_end_date LOOP
        -- Check if this day should be counted
        IF habit_record.frequency_type = 'daily' OR
           (habit_record.frequency_type IN ('weekly', 'custom') AND
            EXTRACT(DOW FROM check_date)::INTEGER = ANY(habit_record.frequency_days)) THEN

            total_days := total_days + 1;

            IF EXISTS(
                SELECT 1 FROM habit_logs
                WHERE habit_id = p_habit_id
                AND date = check_date
                AND status = 'completed'
            ) THEN
                completed_days := completed_days + 1;
            END IF;
        END IF;

        check_date := check_date + 1;
    END LOOP;

    IF total_days = 0 THEN
        RETURN 0;
    END IF;

    RETURN ROUND((completed_days::NUMERIC / total_days::NUMERIC) * 100, 1);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 4: UPDATE TRIGGERS
-- =====================================================

-- Update timestamp trigger for areas
CREATE OR REPLACE FUNCTION update_areas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_areas_updated_at
    BEFORE UPDATE ON areas_of_responsibility
    FOR EACH ROW
    EXECUTE FUNCTION update_areas_updated_at();

-- Update timestamp trigger for habits
CREATE OR REPLACE FUNCTION update_habits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_habits_updated_at
    BEFORE UPDATE ON habits
    FOR EACH ROW
    EXECUTE FUNCTION update_habits_updated_at();

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('areas_of_responsibility', 'sub_areas', 'area_mental_models', 'habits', 'habit_logs')
ORDER BY table_name, ordinal_position;
