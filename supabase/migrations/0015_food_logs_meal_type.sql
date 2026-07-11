-- ---------- food_logs: per-meal grouping (Breakfast / Lunch / Dinner / Snacks) ----------
-- Adds a meal_type column so the Fuel tab can split logged items into meal
-- sections. Existing rows (and any write from an older client) default to
-- 'snacks', so nothing is lost and the app keeps working before/after this runs.

alter table public.food_logs
  add column if not exists meal_type text not null default 'snacks'
  check (meal_type in ('breakfast', 'lunch', 'dinner', 'snacks'));

-- Speeds up the grouped-by-meal read of a single day.
create index if not exists idx_food_logs_user_date_meal
  on public.food_logs (user_id, log_date, meal_type);
