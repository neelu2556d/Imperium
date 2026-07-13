-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- Accent theme preference chosen on /settings. One of 'mint' | 'blue' | 'red'
-- | 'gold'; defaults to the original Mint Green so existing rows keep their
-- look. The whole app recolours from this single value via CSS accent tokens.
alter table public.profiles
  add column if not exists theme_preference text not null default 'mint';
