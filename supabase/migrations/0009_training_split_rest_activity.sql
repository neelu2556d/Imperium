-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- The /onboarding/customize-days screen lets the user rename days, mark rest
-- days, and (for a rest day) jot an optional activity note — e.g. "cardio" or
-- "mobility". That note rides on the training_split row it belongs to.
alter table public.training_split
  add column if not exists rest_activity text;
