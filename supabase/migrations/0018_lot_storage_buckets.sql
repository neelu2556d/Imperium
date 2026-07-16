-- Run this file in the Supabase SQL editor (no migration runner is wired into
-- this repo — same as 0017_business_tab.sql).

-- Storage buckets for the Lots section: design photos shown on lot cards /
-- detail pages, and the raw lot reports (photo or PDF) uploaded at entry time.
-- Mirrors the progress-photos setup in 0013: public buckets so stored public
-- URLs render without signed requests, writes/deletes scoped to the owning
-- user via the `<user_id>/...` path prefix the app uploads under.

insert into storage.buckets (id, name, public)
values ('lot-photos', 'lot-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('lot-reports', 'lot-reports', true)
on conflict (id) do nothing;

drop policy if exists "lot photos are publicly readable" on storage.objects;
create policy "lot photos are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'lot-photos');

drop policy if exists "users upload their own lot photos" on storage.objects;
create policy "users upload their own lot photos"
  on storage.objects
  for insert
  with check (
    bucket_id = 'lot-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users delete their own lot photos" on storage.objects;
create policy "users delete their own lot photos"
  on storage.objects
  for delete
  using (
    bucket_id = 'lot-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "lot reports are publicly readable" on storage.objects;
create policy "lot reports are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'lot-reports');

drop policy if exists "users upload their own lot reports" on storage.objects;
create policy "users upload their own lot reports"
  on storage.objects
  for insert
  with check (
    bucket_id = 'lot-reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users delete their own lot reports" on storage.objects;
create policy "users delete their own lot reports"
  on storage.objects
  for delete
  using (
    bucket_id = 'lot-reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
