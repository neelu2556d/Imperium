-- First, ensure the table exists:
CREATE TABLE IF NOT EXISTS ifct_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_code text UNIQUE,
  name text NOT NULL,
  food_group text,
  calories_per_100g numeric(8,2) NOT NULL,
  protein_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  fat_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  carbs_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  fiber_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  -- editable overrides (user can correct values):
  user_overrides jsonb DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ifct_name 
ON ifct_foods USING gin(to_tsvector('english', name));

-- Then all INSERT statements:
INSERT INTO ifct_foods 
(food_code, name, food_group, calories_per_100g,
 protein_per_100g, fat_per_100g, carbs_per_100g,
 fiber_per_100g)
VALUES

ON CONFLICT (food_code) DO UPDATE SET
  name = EXCLUDED.name,
  calories_per_100g = EXCLUDED.calories_per_100g,
  protein_per_100g = EXCLUDED.protein_per_100g,
  fat_per_100g = EXCLUDED.fat_per_100g,
  carbs_per_100g = EXCLUDED.carbs_per_100g,
  fiber_per_100g = EXCLUDED.fiber_per_100g;
