-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- The 13-question training quiz (/onboarding/training) writes each answer to
-- its own column on the single per-user profiles row, upserting on user_id as
-- the user advances. Two columns (recovery_level, session_duration_min) are new
-- concepts introduced by the quiz; the rest mirror the product's vocabulary.
alter table public.profiles
  add column if not exists training_experience text,       -- step 1
  add column if not exists barbell_confidence text,        -- step 2
  add column if not exists recovery_level text,            -- step 3
  add column if not exists headline_goal text,             -- step 4
  add column if not exists body_bias text[] not null default '{}',           -- step 5
  add column if not exists preferred_split text,           -- step 6
  add column if not exists equipment_preference text,      -- step 7
  add column if not exists rpe_style text,                 -- step 8
  add column if not exists training_days_per_week int,     -- step 9
  add column if not exists session_duration_min int,       -- step 10
  add column if not exists equipment_access text,          -- step 11
  add column if not exists movement_limitations text[] not null default '{}', -- step 12
  add column if not exists lifestyle_activity text;         -- step 13
