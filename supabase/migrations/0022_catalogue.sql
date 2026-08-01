-- Run this file in the Supabase SQL editor (no migration runner is wired into
-- this repo — same as 0017_business_tab.sql).

-- ============================================================================
-- Catalogue — a standalone design-photo library for the Business tab. Each
-- photo is labelled with the design number printed on it (auto-read by the
-- /api/scan-design-photo route) and the dress-material item it belongs to.
-- Independent of Lots: a photo lives here even when no lot references it.
--
-- Same conventions as 0017: user_id FK to auth.users, RLS on, one "users
-- manage their own rows" policy scoped to auth.uid(). item_id is `set null`
-- so the label survives a master-record deletion (item_name is denormalised
-- for fast display). Everything is idempotent so the file is safe to re-run.
-- ============================================================================

create table if not exists public.catalogue_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid references public.item_master (id) on delete set null,
  item_name text,              -- denormalised for fast display
  d_no text,                   -- design number, e.g. "530" or "TT-247"
  image_url text not null,     -- Supabase Storage URL (catalogue-photos bucket)
  created_at timestamptz not null default now()
);

create index if not exists idx_catalogue_photos_user on public.catalogue_photos (user_id);
create index if not exists idx_catalogue_photos_item on public.catalogue_photos (item_id);

alter table public.catalogue_photos enable row level security;

drop policy if exists "users manage their own catalogue photos" on public.catalogue_photos;
create policy "users manage their own catalogue photos"
  on public.catalogue_photos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- orders.updated_at — updateOrder / createPayment already write this column but
-- no migration defines it (the live DB was altered ad-hoc). Idempotent, so the
-- full order-edit path can never fail on a missing-column error.
-- ============================================================================
alter table public.orders
  add column if not exists updated_at timestamptz not null default now();

-- ============================================================================
-- Storage — public bucket for the catalogue photos, mirroring the lot-photos
-- setup in 0018: public reads so stored public URLs render without signed
-- requests, writes/deletes scoped to the owning user via the `<user_id>/...`
-- path prefix the app uploads under. Distinct policy names so this file can
-- be re-run alongside 0018 without collisions.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('catalogue-photos', 'catalogue-photos', true)
on conflict (id) do nothing;

drop policy if exists "catalogue photos are publicly readable" on storage.objects;
create policy "catalogue photos are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'catalogue-photos');

drop policy if exists "users upload their own catalogue photos" on storage.objects;
create policy "users upload their own catalogue photos"
  on storage.objects
  for insert
  with check (
    bucket_id = 'catalogue-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users delete their own catalogue photos" on storage.objects;
create policy "users delete their own catalogue photos"
  on storage.objects
  for delete
  using (
    bucket_id = 'catalogue-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
