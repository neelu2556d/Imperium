-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- The /vitals tab reads/writes body_weight_logs and progress_photos. Both were
-- sketched in the old root `supabase_schema.sql` WITHOUT a user_id or RLS (like
-- the four log tables 0008 later fixed), so per-user queries return nothing.
-- This migration brings them in line — user_id FK + "users manage their own
-- rows" policy — and adds the optional `notes` column the photo check-in writes.
-- It also provisions the `progress-photos` Storage bucket + its access policies.

-- ---------- body_weight_logs (Vitals: weight trend line) ----------
create table if not exists public.body_weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  log_date date not null default current_date,
  weight numeric not null,
  created_at timestamptz not null default now()
);

alter table public.body_weight_logs
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.body_weight_logs enable row level security;

drop policy if exists "users manage their own body weight logs" on public.body_weight_logs;
create policy "users manage their own body weight logs"
  on public.body_weight_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_body_weight_logs_user_date
  on public.body_weight_logs (user_id, log_date);

-- ---------- progress_photos (Vitals: check-in timeline) ----------
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  log_date date not null default current_date,
  image_url text not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.progress_photos
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.progress_photos
  add column if not exists notes text;

alter table public.progress_photos enable row level security;

drop policy if exists "users manage their own progress photos" on public.progress_photos;
create policy "users manage their own progress photos"
  on public.progress_photos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_progress_photos_user_date
  on public.progress_photos (user_id, log_date);

-- ---------- Storage bucket for the check-in photos ----------
-- Public bucket so the stored public URL renders without a signed request;
-- writes/updates/deletes stay scoped to the owning user via the object path
-- prefix `<user_id>/...` that the app uploads under.
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', true)
on conflict (id) do nothing;

drop policy if exists "progress photos are publicly readable" on storage.objects;
create policy "progress photos are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'progress-photos');

drop policy if exists "users upload their own progress photos" on storage.objects;
create policy "users upload their own progress photos"
  on storage.objects
  for insert
  with check (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users delete their own progress photos" on storage.objects;
create policy "users delete their own progress photos"
  on storage.objects
  for delete
  using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
