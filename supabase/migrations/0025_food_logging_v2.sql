-- ---------- Fuel logging v2: custom_foods + rebuilt food_logs ----------
-- Run this file in the Supabase SQL editor AFTER 0024_indian_foods.sql.
--
-- WARNING: this recreates food_logs with the richer schema the rebuilt Fuel
-- tab needs (per-serving amounts/units, gram weight, fiber, brand, and a
-- food_source/food_ref_id provenance pair). The DROP discards any rows written
-- under the old 0008/0015 schema (item_name + bare protein/fat/carbs). That is
-- intentional for the overhaul — the old columns can't carry the new data.

CREATE TABLE IF NOT EXISTS custom_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  brand text,
  calories_per_100g numeric(8,2) NOT NULL,
  protein_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  fat_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  carbs_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  fiber_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  default_serving_g numeric(8,2) DEFAULT 100,
  default_unit text DEFAULT 'g',
  source text DEFAULT 'quick_add',
  original_values jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_foods_user_name
  ON custom_foods (user_id, lower(name));

DROP TABLE IF EXISTS food_logs;
CREATE TABLE food_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  logged_date date NOT NULL DEFAULT current_date,
  -- App writes explicit 'breakfast'/'lunch'/'dinner'/'snacks'; default kept as
  -- 'snacks' to match the client MealType union.
  meal_type text NOT NULL DEFAULT 'snacks',
  food_source text NOT NULL,
  food_ref_id text,
  food_name text NOT NULL,
  brand text,
  serving_amount numeric(8,2) NOT NULL DEFAULT 100,
  serving_unit text NOT NULL DEFAULT 'g',
  serving_g numeric(8,2) NOT NULL,
  calories numeric(8,2) NOT NULL,
  protein_g numeric(8,2) NOT NULL DEFAULT 0,
  fat_g numeric(8,2) NOT NULL DEFAULT 0,
  carbs_g numeric(8,2) NOT NULL DEFAULT 0,
  fiber_g numeric(8,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_logs_user_date
  ON food_logs (user_id, logged_date);

ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_food_logs" ON food_logs;
CREATE POLICY "user_food_logs" ON food_logs
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE custom_foods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_custom_foods" ON custom_foods;
CREATE POLICY "user_custom_foods" ON custom_foods
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE indian_foods
  ADD COLUMN IF NOT EXISTS user_overrides jsonb DEFAULT NULL;

-- Let PostgREST see the new tables/columns immediately.
NOTIFY pgrst, 'reload schema';
