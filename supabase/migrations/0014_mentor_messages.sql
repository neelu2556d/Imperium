-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- The /mentor tab is a chat with the Groq-powered coach. Every turn (both the
-- user's message and the mentor's reply) is persisted so the thread survives a
-- reload and can be fed back as conversation history on the next request.
--
-- The old root `supabase_schema.sql` sketched this table WITHOUT a user_id or
-- RLS, so per-user queries returned nothing. This migration brings it in line
-- with the rest of the schema (matches set_logs / training_split): a user_id
-- foreign key to auth.users and a "users manage their own rows" policy. The
-- `alter table ... add column if not exists` handles databases where the table
-- already exists from the old paste-in schema.
create table if not exists public.mentor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'mentor')),
  content text not null,
  context_snapshot jsonb,
  created_at timestamptz not null default now()
);

alter table public.mentor_messages
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.mentor_messages enable row level security;

drop policy if exists "users manage their own mentor messages" on public.mentor_messages;
create policy "users manage their own mentor messages"
  on public.mentor_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_mentor_messages_user_created
  on public.mentor_messages (user_id, created_at);
