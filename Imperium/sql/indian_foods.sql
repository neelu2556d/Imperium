CREATE TABLE IF NOT EXISTS indian_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  calories_per_100g numeric(8,2) NOT NULL,
  protein_per_100g numeric(8,2) NOT NULL,
  fat_per_100g numeric(8,2) NOT NULL,
  carbs_per_100g numeric(8,2) NOT NULL,
  fiber_per_100g numeric(8,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_indian_foods_name ON indian_foods USING gin(to_tsvector('english', name));