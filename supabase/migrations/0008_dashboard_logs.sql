-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- The /home dashboard reads four log tables to power its bento cards. These
-- tables were sketched in the old root `supabase_schema.sql` WITHOUT a user_id
-- or RLS, so per-user queries return nothing. This migration brings them in
-- line with the rest of the schema: a `user_id` foreign key to auth.users and
-- a "users manage their own rows" policy, matching training_split (0007).
--
-- `create table if not exists` handles fresh databases; the `alter table ...
-- add column if not exists user_id` right after handles databases where the
-- table already exists from the old paste-in schema (which lacked user_id).

-- ---------- set_logs (Train sparkline: Σ weight·reps per session) ----------
create table if not exists public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  exercise_id uuid,
  log_date date not null default current_date,
  set_number int,
  weight numeric,
  reps int,
  rpe numeric,
  is_failure boolean not null default false,
  is_deload boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.set_logs
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.set_logs enable row level security;

drop policy if exists "users manage their own set logs" on public.set_logs;
create policy "users manage their own set logs"
  on public.set_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_set_logs_user_date
  on public.set_logs (user_id, log_date);

-- ---------- sleep_logs (Vitals sparkline: hours vs goal) ----------
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  log_date date not null default current_date,
  hours numeric not null,
  goal_hours numeric not null default 7.15,
  created_at timestamptz not null default now()
);

alter table public.sleep_logs
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.sleep_logs enable row level security;

drop policy if exists "users manage their own sleep logs" on public.sleep_logs;
create policy "users manage their own sleep logs"
  on public.sleep_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_sleep_logs_user_date
  on public.sleep_logs (user_id, log_date);

-- ---------- water_logs (Vitals: today's litres) ----------
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  log_date date not null default current_date,
  amount_liters numeric not null,
  goal_liters numeric not null default 3.5,
  created_at timestamptz not null default now()
);

alter table public.water_logs
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.water_logs enable row level security;

drop policy if exists "users manage their own water logs" on public.water_logs;
create policy "users manage their own water logs"
  on public.water_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_water_logs_user_date
  on public.water_logs (user_id, log_date);

-- ---------- food_logs (Fuel ring: today's calories + macros) ----------
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  log_date date not null default current_date,
  item_name text not null,
  calories numeric,
  protein numeric,
  fat numeric,
  carbs numeric,
  source text not null default 'manual' check (source in ('manual', 'screenshot_import')),
  created_at timestamptz not null default now()
);

alter table public.food_logs
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.food_logs enable row level security;

drop policy if exists "users manage their own food logs" on public.food_logs;
create policy "users manage their own food logs"
  on public.food_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_food_logs_user_date
  on public.food_logs (user_id, log_date);
