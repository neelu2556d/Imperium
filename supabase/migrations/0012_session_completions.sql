-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- The /train/session/[day_id] logging screen marks a session "done" when the
-- user taps "Finish session ★". The set_logs already capture what was lifted;
-- this table records the completion event itself so the dashboard (and a future
-- streak view) can tell a finished session from one that was merely opened.
--
-- One row per (day, date): re-finishing the same day on the same date upserts
-- rather than duplicating. `is_deload` mirrors the toggle the user finished on.
create table if not exists public.session_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  training_split_id uuid not null references public.training_split (id) on delete cascade,
  completed_date date not null default current_date,
  is_deload boolean not null default false,
  created_at timestamptz not null default now(),
  unique (training_split_id, completed_date)
);

alter table public.session_completions enable row level security;

drop policy if exists "users manage their own session completions" on public.session_completions;
create policy "users manage their own session completions"
  on public.session_completions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_session_completions_user_date
  on public.session_completions (user_id, completed_date);
