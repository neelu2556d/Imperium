-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- The Business tab tracks a dress-material wholesale operation: an item + party
-- master, saved rate cards, lot arrivals, orders logged against each lot, and
-- payment receipts. It sits alongside the fitness tables and follows the same
-- conventions (matches mentor_messages / training_split): every table carries a
-- user_id foreign key to auth.users, RLS is enabled, and the only policy is
-- "users manage their own rows" scoped to auth.uid(). This data is strictly
-- private — there is no shared/read-only access path anywhere in this file.
--
-- gen_random_uuid() ships with Supabase (pgcrypto), so no extension is needed.
-- Everything is written idempotently so the file is safe to re-run.

-- ============================================================================
-- item_master — dress material sets, each with 3 fixed components (top/bottom/
-- dupatta). item_name is unique per user.
-- ============================================================================
create table if not exists public.item_master (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, item_name)
);

-- ============================================================================
-- party_master — customers/buyers. cd_percent is the cash discount given when a
-- party pays within default_payment_days.
-- ============================================================================
create table if not exists public.party_master (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  party_name text not null,
  area text,
  city text,
  default_payment_days integer not null default 45,
  cd_percent numeric(5,2) not null default 0,
  gst_preference text not null default 'non_gst'
    check (gst_preference in ('gst', 'non_gst')),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, party_name)
);

-- ============================================================================
-- party_rate_cards — saved top/bottom/dupatta rates for a party + item pair.
-- Auto-filled on order entry when both party and item are selected.
-- ============================================================================
create table if not exists public.party_rate_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  party_id uuid not null references public.party_master (id) on delete cascade,
  item_id uuid not null references public.item_master (id) on delete cascade,
  top_rate numeric(10,2),      -- ₹ per metre
  bottom_rate numeric(10,2),   -- ₹ per metre
  dupatta_rate numeric(10,2),  -- ₹ per metre
  updated_at timestamptz not null default now(),
  unique (user_id, party_id, item_id)
);

-- ============================================================================
-- lots — master record for each lot arrival. item_name / d_no are denormalised
-- for fast display. Opening stock is the metres available at arrival.
-- ============================================================================
create table if not exists public.lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid references public.item_master (id) on delete set null,
  item_name text,                     -- denormalised for fast display
  d_no text,                          -- design number e.g. "TT-247"
  design_photo_url text,              -- Supabase Storage URL
  lot_report_url text,                -- uploaded PDF/photo URL
  date_arrived date not null default current_date,
  top_opening_stock numeric(10,2),        -- metres
  bottom_opening_stock numeric(10,2),     -- metres
  dupatta_opening_stock numeric(10,2),    -- metres
  top_cost_per_metre numeric(10,2),
  bottom_cost_per_metre numeric(10,2),
  dupatta_cost_per_metre numeric(10,2),
  status text not null default 'arrived'
    check (status in ('arrived', 'active', 'low_stock', 'cleared', 'dead_stock')),
  low_stock_threshold_metres numeric(10,2) not null default 100,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- orders — each order logged against a lot. Totals and pricing are stored (not
-- computed on read) so reports stay fast. item_name / d_no / party_name are
-- denormalised copies; the FKs use `set null` so those copies survive a master
-- record deletion.
-- ============================================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lot_id uuid references public.lots (id) on delete cascade,
  party_id uuid references public.party_master (id) on delete set null,
  item_id uuid references public.item_master (id) on delete set null,
  item_name text,   -- denormalised
  d_no text,        -- denormalised from lot
  party_name text,  -- denormalised
  order_date date not null default current_date,

  -- Per-colour quantities (metres per colour)
  top_metres_per_colour numeric(10,2),
  bottom_metres_per_colour numeric(10,2),
  dupatta_metres_per_colour numeric(10,2),
  num_colours integer,

  -- Auto-calculated totals (stored for reporting speed)
  top_total_metres numeric(10,2),      -- per_colour × num_colours
  bottom_total_metres numeric(10,2),
  dupatta_total_metres numeric(10,2),
  total_metres numeric(10,2),          -- sum of all 3

  -- Rates
  top_rate numeric(10,2),
  bottom_rate numeric(10,2),
  dupatta_rate numeric(10,2),

  -- Pricing
  top_amount numeric(12,2),            -- top_total × top_rate
  bottom_amount numeric(12,2),
  dupatta_amount numeric(12,2),
  subtotal numeric(12,2),
  discount_percent numeric(5,2) not null default 0,
  discount_amount numeric(12,2),
  after_discount numeric(12,2),
  gst_applicable boolean not null default false,
  gst_amount numeric(12,2) not null default 0,   -- 5% if applicable
  total_amount numeric(12,2),
  cd_percent numeric(5,2) not null default 0,
  cd_amount numeric(12,2) not null default 0,
  net_payable numeric(12,2),

  -- Payment tracking
  payment_days integer not null default 45,
  due_date date,                       -- order_date + payment_days
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'overdue', 'partial')),
  amount_received numeric(12,2) not null default 0,
  payment_date date,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- payments — individual payment receipts against an order.
-- ============================================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  party_id uuid references public.party_master (id) on delete set null,
  party_name text,
  amount_received numeric(12,2),
  payment_date date not null default current_date,
  cd_applied boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- business_mentor_messages — the Business tab's own coach thread, kept separate
-- from the fitness mentor_messages table.
-- ============================================================================
create table if not exists public.business_mentor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text check (role in ('user', 'mentor')),
  content text,
  context_type text
    check (context_type in ('morning_briefing', 'pre_visit', 'post_day', 'chat')),
  context_snapshot jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes — FK lookups plus the hot filter paths (status, payment status,
-- due date, rate-card lookup by party+item).
-- ============================================================================
create index if not exists idx_item_master_user       on public.item_master (user_id);
create index if not exists idx_party_master_user      on public.party_master (user_id);
create index if not exists idx_rate_cards_user        on public.party_rate_cards (user_id);
create index if not exists idx_rate_cards_party_item  on public.party_rate_cards (party_id, item_id);
create index if not exists idx_lots_user              on public.lots (user_id);
create index if not exists idx_lots_item              on public.lots (item_id);
create index if not exists idx_lots_status            on public.lots (user_id, status);
create index if not exists idx_orders_user            on public.orders (user_id);
create index if not exists idx_orders_lot             on public.orders (lot_id);
create index if not exists idx_orders_party           on public.orders (party_id);
create index if not exists idx_orders_payment_status  on public.orders (user_id, payment_status);
create index if not exists idx_orders_due_date        on public.orders (due_date);
create index if not exists idx_payments_user          on public.payments (user_id);
create index if not exists idx_payments_order         on public.payments (order_id);
create index if not exists idx_bmm_user_created       on public.business_mentor_messages (user_id, created_at);

-- ============================================================================
-- Row level security — every table on, one "users manage their own rows"
-- policy each, scoped to auth.uid(). No shared or read-only access anywhere.
-- ============================================================================
alter table public.item_master              enable row level security;
alter table public.party_master             enable row level security;
alter table public.party_rate_cards         enable row level security;
alter table public.lots                     enable row level security;
alter table public.orders                   enable row level security;
alter table public.payments                 enable row level security;
alter table public.business_mentor_messages enable row level security;

drop policy if exists "users manage their own items" on public.item_master;
create policy "users manage their own items"
  on public.item_master
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage their own parties" on public.party_master;
create policy "users manage their own parties"
  on public.party_master
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage their own rate cards" on public.party_rate_cards;
create policy "users manage their own rate cards"
  on public.party_rate_cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage their own lots" on public.lots;
create policy "users manage their own lots"
  on public.lots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage their own orders" on public.orders;
create policy "users manage their own orders"
  on public.orders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage their own payments" on public.payments;
create policy "users manage their own payments"
  on public.payments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage their own business mentor messages" on public.business_mentor_messages;
create policy "users manage their own business mentor messages"
  on public.business_mentor_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- stock_register — a view (not a table) for fast stock display: opening stock
-- minus the sum of everything sold, per lot. `security_invoker = true` makes
-- the view run with the querying user's privileges, so RLS on lots/orders
-- applies and one user can never see another's stock through the view.
-- ============================================================================
create or replace view public.stock_register
with (security_invoker = true) as
select
  l.id as lot_id,
  l.user_id,
  l.item_name,
  l.d_no,
  l.design_photo_url,
  l.date_arrived,
  l.status,
  l.top_opening_stock,
  l.bottom_opening_stock,
  l.dupatta_opening_stock,
  l.low_stock_threshold_metres,
  coalesce(sum(o.top_total_metres), 0) as top_sold,
  coalesce(sum(o.bottom_total_metres), 0) as bottom_sold,
  coalesce(sum(o.dupatta_total_metres), 0) as dupatta_sold,
  l.top_opening_stock - coalesce(sum(o.top_total_metres), 0)
    as top_remaining,
  l.bottom_opening_stock - coalesce(sum(o.bottom_total_metres), 0)
    as bottom_remaining,
  l.dupatta_opening_stock - coalesce(sum(o.dupatta_total_metres), 0)
    as dupatta_remaining
from public.lots l
left join public.orders o on o.lot_id = l.id
group by l.id;

-- ============================================================================
-- update_lot_status() — after any order insert/update, recompute the parent
-- lot's status from remaining stock and age. Order of the CASE branches
-- matters: cleared > low_stock > dead_stock > active.
-- ============================================================================
create or replace function public.update_lot_status()
returns trigger as $$
declare
  top_rem numeric;
  bot_rem numeric;
  dup_rem numeric;
  threshold numeric;
  days_since integer;
begin
  select
    l.top_opening_stock - coalesce(sum(o.top_total_metres), 0),
    l.bottom_opening_stock - coalesce(sum(o.bottom_total_metres), 0),
    l.dupatta_opening_stock - coalesce(sum(o.dupatta_total_metres), 0),
    l.low_stock_threshold_metres,
    extract(day from now() - l.date_arrived)::integer
  into top_rem, bot_rem, dup_rem, threshold, days_since
  from public.lots l
  left join public.orders o on o.lot_id = l.id
  where l.id = new.lot_id
  group by l.id;

  update public.lots set status =
    case
      when top_rem <= 0 and bot_rem <= 0 and dup_rem <= 0
        then 'cleared'
      when (top_rem < threshold or bot_rem < threshold
            or dup_rem < threshold)
        then 'low_stock'
      when days_since > 45
        and top_rem > threshold
        then 'dead_stock'
      else 'active'
    end
  where id = new.lot_id;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_lot_status on public.orders;
create trigger trg_update_lot_status
after insert or update on public.orders
for each row execute function public.update_lot_status();

-- ============================================================================
-- refresh_overdue_orders() — flip still-pending orders to 'overdue' once their
-- due_date has passed. Call this on Business-tab load, or schedule it with
-- pg_cron (commented example below). Only 'pending' rows are touched; 'partial'
-- orders are left as-is.
-- ============================================================================
create or replace function public.refresh_overdue_orders()
returns void as $$
  update public.orders
  set payment_status = 'overdue'
  where payment_status = 'pending'
    and due_date < current_date;
$$ language sql;

-- Optional daily schedule (enable the pg_cron extension in Supabase first):
-- select cron.schedule('refresh-overdue-orders', '0 1 * * *',
--                      $$ select public.refresh_overdue_orders(); $$);
