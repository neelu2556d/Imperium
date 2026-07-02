-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- The "About you" onboarding step collects the basics. We store name on the
-- existing `name`-adjacent column set; `first_name` predates this step, so we
-- add `name` for the free-form "what should I call you" answer plus the
-- physical stats. Height and weight are always persisted in metric (cm / kg)
-- regardless of the unit toggle the user picked in the UI.
alter table public.profiles
  add column if not exists name text,
  add column if not exists age int,
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric;
