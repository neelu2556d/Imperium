-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- The /onboarding/pick-exercises screen writes one row per exercise the user
-- picked for a training day, in display order, with the prescribed sets × reps
-- from the "Tune" sheet. Like the sketch in the old root `supabase_schema.sql`
-- this joins a training_split day to an exercise — but with a user_id + RLS to
-- match the rest of the schema, plus the prescription columns the Tune sheet
-- needs (default 4 × 8).
--
-- Rows are cascade-deleted when their training_split day is deleted. Because
-- customize-days rewrites the split wholesale (new day ids), pick-exercises
-- always reads the freshly-saved day ids before writing picks against them.

create table if not exists public.day_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  training_split_id uuid not null references public.training_split (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  exercise_order int not null default 0,
  prescribed_sets int not null default 4,
  prescribed_reps int not null default 8,
  is_pick boolean not null default true,
  created_at timestamptz not null default now(),
  unique (training_split_id, exercise_id)
);

alter table public.day_exercises
  add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.day_exercises
  add column if not exists prescribed_sets int not null default 4;
alter table public.day_exercises
  add column if not exists prescribed_reps int not null default 8;

alter table public.day_exercises enable row level security;

drop policy if exists "users manage their own day exercises" on public.day_exercises;
create policy "users manage their own day exercises"
  on public.day_exercises
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_day_exercises_split_order
  on public.day_exercises (training_split_id, exercise_order);
