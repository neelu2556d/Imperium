-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users manage their own profile row"
  on public.profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
