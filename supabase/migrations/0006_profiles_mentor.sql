-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- Mentor personality settings collected on /onboarding/mentor: a single tone
-- and any number of focus areas.
alter table public.profiles
  add column if not exists mentor_tone text,
  add column if not exists mentor_focus text[] not null default '{}';
