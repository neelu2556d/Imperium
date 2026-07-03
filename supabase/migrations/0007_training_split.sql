-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- The /onboarding/split screen writes the user's chosen split as one row per
-- day of the week (training days + rest days), ordered by day_order. It is
-- rewritten wholesale whenever the user picks a different split template, so
-- callers delete the user's existing rows before inserting the new ones.
create table if not exists public.training_split (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  day_order int not null,
  is_rest_day boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.training_split enable row level security;

create policy "users manage their own split rows"
  on public.training_split
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_training_split_user_order
  on public.training_split (user_id, day_order);
