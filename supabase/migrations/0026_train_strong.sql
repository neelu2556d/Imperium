-- ---------- Train tab v2: Strong-style routines / sessions / sets / PRs ----------
-- Run this file in the Supabase SQL editor. `exercises` (migration 0010) is the
-- shared/custom exercise library the FKs below point at (uuid PK).
--
-- NOTE: the source spec used a `NULLABLE` keyword, which Postgres does not have
-- (columns are nullable unless marked NOT NULL). Those columns are plain
-- nullable here. Child-table policies use USING only; Postgres reuses the USING
-- expression as the INSERT check when WITH CHECK is omitted, so inserts scoped
-- to the caller's own parent rows are allowed.

-- Workout routines (templates the user builds)
CREATE TABLE IF NOT EXISTS workout_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  notes text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Exercises assigned to a routine (template)
CREATE TABLE IF NOT EXISTS routine_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid REFERENCES workout_routines ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercises,
  exercise_name text NOT NULL,
  display_order integer DEFAULT 0,
  default_sets integer DEFAULT 3,
  default_reps integer DEFAULT 8,
  default_weight_kg numeric(8,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- A completed or in-progress workout session
CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  routine_id uuid REFERENCES workout_routines,
  name text NOT NULL,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  duration_seconds integer,
  total_volume_kg numeric(12,2) DEFAULT 0,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Exercises logged in a session
CREATE TABLE IF NOT EXISTS session_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES workout_sessions ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercises,
  exercise_name text NOT NULL,
  display_order integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Individual sets logged in a session
CREATE TABLE IF NOT EXISTS session_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_id uuid REFERENCES session_exercises ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users NOT NULL,
  exercise_id uuid REFERENCES exercises,
  exercise_name text NOT NULL,
  set_number integer NOT NULL,
  weight_kg numeric(8,2) DEFAULT 0,
  reps integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  is_warmup boolean DEFAULT false,
  rpe numeric(4,2),
  logged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Personal records (auto-updated on set completion)
CREATE TABLE IF NOT EXISTS personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  exercise_id uuid REFERENCES exercises,
  exercise_name text NOT NULL,
  best_weight_kg numeric(8,2) DEFAULT 0,
  best_reps integer DEFAULT 0,
  best_volume_kg numeric(8,2) DEFAULT 0,
  estimated_1rm numeric(8,2) DEFAULT 0,
  achieved_at timestamptz DEFAULT now(),
  session_id uuid REFERENCES workout_sessions,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, exercise_name)
);

-- Body measurements
CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  measured_at date DEFAULT current_date,
  weight_kg numeric(8,2),
  body_fat_percent numeric(5,2),
  chest_cm numeric(8,2),
  waist_cm numeric(8,2),
  hips_cm numeric(8,2),
  arms_cm numeric(8,2),
  thighs_cm numeric(8,2),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Helpful indexes for the reads the Train tab makes.
CREATE INDEX IF NOT EXISTS idx_workout_routines_user ON workout_routines (user_id, display_order);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises (routine_id, display_order);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_active ON workout_sessions (user_id, is_active, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_exercises_session ON session_exercises (session_id, display_order);
CREATE INDEX IF NOT EXISTS idx_session_sets_exercise ON session_sets (session_exercise_id, set_number);
CREATE INDEX IF NOT EXISTS idx_personal_records_user ON personal_records (user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_date ON body_measurements (user_id, measured_at DESC);

-- RLS on all tables
ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_routines" ON workout_routines;
CREATE POLICY "own_routines" ON workout_routines
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_routine_exercises" ON routine_exercises;
CREATE POLICY "own_routine_exercises" ON routine_exercises
  USING (routine_id IN (
    SELECT id FROM workout_routines WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "own_sessions" ON workout_sessions;
CREATE POLICY "own_sessions" ON workout_sessions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_session_exercises" ON session_exercises;
CREATE POLICY "own_session_exercises" ON session_exercises
  USING (session_id IN (
    SELECT id FROM workout_sessions WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "own_session_sets" ON session_sets;
CREATE POLICY "own_session_sets" ON session_sets
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_records" ON personal_records;
CREATE POLICY "own_records" ON personal_records
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_measurements" ON body_measurements;
CREATE POLICY "own_measurements" ON body_measurements
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Let PostgREST see the new tables/columns immediately.
NOTIFY pgrst, 'reload schema';
