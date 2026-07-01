-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_step text not null default 'welcome',
  completed_steps text[] not null default '{}',
  is_complete boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;

create policy "users manage their own onboarding row"
  on public.user_onboarding
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
