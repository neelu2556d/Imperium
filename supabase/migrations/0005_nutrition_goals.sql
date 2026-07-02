-- Add user_id if it doesn't exist
alter table public.nutrition_goals
add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Make each user have only one row
alter table public.nutrition_goals
add constraint nutrition_goals_user_unique
unique (user_id);

-- Enable RLS
alter table public.nutrition_goals
enable row level security;

-- Remove old policy if present
drop policy if exists "users manage their own nutrition goals"
on public.nutrition_goals;

-- Create correct policy
create policy "users manage their own nutrition goals"
on public.nutrition_goals
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);