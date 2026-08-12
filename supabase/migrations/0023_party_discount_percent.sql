-- Run this file in the Supabase SQL editor (no migration runner is wired into
-- this repo — same as 0017_business_tab.sql).

-- ============================================================================
-- Party default discount% — part of the party's remembered payment terms.
-- 0017 already stored default_payment_days and cd_percent; this adds the trade
-- discount (default_discount_percent) that the order form applies to the
-- subtotal for that party. Same conventions: idempotent, defaults to 0 so
-- existing rows price as before until explicitly set.
-- ============================================================================

alter table public.party_master
  add column if not exists default_discount_percent numeric(5,2) not null default 0;