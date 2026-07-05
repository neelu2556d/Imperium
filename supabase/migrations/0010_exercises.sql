-- Run this file in the Supabase SQL editor (or via `supabase db push` if you
-- adopt the Supabase CLI later). There is no migration runner wired into this
-- repo yet, so this file is applied manually.

-- The /onboarding/pick-exercises screen searches this library by name and adds
-- results to a day's picks. The table was sketched in the old root
-- `supabase_schema.sql` WITHOUT a user_id or RLS; this migration brings it in
-- line with the rest of the schema (training_split 0007, dashboard logs 0008).
--
-- `user_id` is NULLABLE on purpose: rows with `user_id = null` are the shared,
-- read-only library everyone searches; rows a user creates (a custom exercise
-- they typed in) carry their own uid. The select policy exposes both; writes
-- are restricted to the caller's own rows.

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  muscle_group text,
  equipment_type text,
  tier text,
  notes text,
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.exercises
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.exercises enable row level security;

drop policy if exists "anyone reads the shared exercise library" on public.exercises;
create policy "anyone reads the shared exercise library"
  on public.exercises
  for select
  using (user_id is null or auth.uid() = user_id);

drop policy if exists "users insert their own exercises" on public.exercises;
create policy "users insert their own exercises"
  on public.exercises
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update their own exercises" on public.exercises;
create policy "users update their own exercises"
  on public.exercises
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete their own exercises" on public.exercises;
create policy "users delete their own exercises"
  on public.exercises
  for delete
  using (auth.uid() = user_id);

-- One shared-library row per name keeps the seed idempotent and lets the app
-- resolve a name → id without duplicating rows. (Partial unique index because
-- per-user custom exercises may legitimately reuse a library name.)
create unique index if not exists idx_exercises_library_name
  on public.exercises (name)
  where user_id is null;

-- ---------- seed: the shared library ----------
-- Every exercise the pick-exercises screen pre-populates, plus a broad set so
-- search returns useful results. `notes` holds the one-line form cue shown in
-- the info tooltip. Idempotent via ON CONFLICT on the partial unique index.
insert into public.exercises (name, muscle_group, equipment_type, tier, notes)
values
  -- Chest & Shoulders
  ('Incline Machine Press', 'Chest', 'Machine', 'Primary', 'Drive up and slightly in; stop before the elbows lock.'),
  ('Cable Flies', 'Chest', 'Cable', 'Accessory', 'Soft elbows, hug the arms together, squeeze at the middle.'),
  ('Bench Press', 'Chest', 'Barbell', 'Primary', 'Bar to mid-chest, elbows tucked ~45°, press in an arc.'),
  ('Incline DB Press', 'Chest', 'Dumbbell', 'Primary', 'Wrists stacked over elbows; lower until you feel a stretch.'),
  ('Pec Deck', 'Chest', 'Machine', 'Accessory', 'Lead with the elbows, pause on the squeeze.'),
  ('Push-ups', 'Chest', 'Bodyweight', 'Accessory', 'Rigid plank, elbows back, chest to the floor.'),
  ('Front Raises', 'Shoulders', 'Dumbbell', 'Accessory', 'Raise to eye level, thumbs up, no swinging.'),
  ('Lateral Raises', 'Shoulders', 'Dumbbell', 'Accessory', 'Lead with the elbows, pour-the-jug tilt at the top.'),
  ('Cable Lateral Raise', 'Shoulders', 'Cable', 'Accessory', 'Cable behind the body; smooth arc out to shoulder height.'),
  ('Overhead Press', 'Shoulders', 'Barbell', 'Primary', 'Brace hard, bar over the crown, ribs down.'),
  ('Arnold Press', 'Shoulders', 'Dumbbell', 'Primary', 'Rotate palms out as you press; control the twist down.'),
  ('Rear Delt Flies', 'Shoulders', 'Dumbbell', 'Accessory', 'Hinge forward, pinkies up, spread the arms wide.'),
  ('Face Pulls', 'Shoulders', 'Cable', 'Accessory', 'Pull to the forehead, elbows high, thumbs back.'),
  -- Back
  ('Lat Pulldown', 'Back', 'Cable', 'Primary', 'Chest up, drive elbows to the hips, no leaning back.'),
  ('Seated Row', 'Back', 'Cable', 'Primary', 'Neutral spine, pull to the navel, squeeze the blades.'),
  ('Cable Pullovers', 'Back', 'Cable', 'Accessory', 'Tall chest, sweep the bar down with straight-ish arms.'),
  ('Pull-ups', 'Back', 'Bodyweight', 'Primary', 'Full hang to chin over the bar; drive elbows down.'),
  ('Barbell Row', 'Back', 'Barbell', 'Primary', 'Hinge ~45°, pull to the lower ribs, control the drop.'),
  ('T-Bar Row', 'Back', 'Machine', 'Primary', 'Flat back, elbows tight, squeeze at the top.'),
  ('Deadlift', 'Back', 'Barbell', 'Primary', 'Bar over mid-foot, push the floor away, hips and chest rise together.'),
  ('Shrugs', 'Back', 'Dumbbell', 'Accessory', 'Straight up to the ears, pause, no rolling.'),
  -- Legs
  ('Barbell Squats', 'Legs', 'Barbell', 'Primary', 'Brace, break at the hips and knees, chest tall out of the hole.'),
  ('Leg Curls', 'Legs', 'Machine', 'Accessory', 'Curl hard, pause, resist the way back.'),
  ('Leg Extensions', 'Legs', 'Machine', 'Accessory', 'Squeeze the quads at the top, slow negative.'),
  ('Romanian Deadlifts', 'Legs', 'Barbell', 'Primary', 'Soft knees, push hips back, feel the hamstring stretch.'),
  ('Calf Raises', 'Calves', 'Machine', 'Accessory', 'Full stretch at the bottom, tall pause at the top.'),
  ('Leg Press', 'Legs', 'Machine', 'Primary', 'Feet shoulder-width, lower to 90°, no lower-back rounding.'),
  ('Goblet Squat', 'Legs', 'Dumbbell', 'Accessory', 'Elbows inside the knees, upright torso, sit tall.'),
  ('Bulgarian Split Squat', 'Legs', 'Dumbbell', 'Primary', 'Weight on the front heel, drop straight down.'),
  ('Walking Lunges', 'Legs', 'Dumbbell', 'Accessory', 'Long stride, tall torso, knee tracks over the toe.'),
  ('Hip Thrust', 'Glutes', 'Barbell', 'Primary', 'Chin tucked, ribs down, squeeze the glutes at lockout.'),
  ('Seated Calf Raise', 'Calves', 'Machine', 'Accessory', 'Drive through the ball of the foot, full range.'),
  -- Arms
  ('Preacher Curl', 'Arms', 'Machine', 'Primary', 'Armpits on the pad, full stretch, no swinging up.'),
  ('BB Overhead Extension', 'Arms', 'Barbell', 'Primary', 'Elbows tight to the head, stretch behind, lock out overhead.'),
  ('Incline Curls', 'Arms', 'Dumbbell', 'Accessory', 'Arms hang back on the incline for a deep biceps stretch.'),
  ('Rope Pushdowns', 'Arms', 'Cable', 'Accessory', 'Elbows pinned, split the rope at the bottom.'),
  ('Hammer Curls', 'Arms', 'Dumbbell', 'Accessory', 'Neutral grip, controlled, hits the brachialis.'),
  ('Barbell Curl', 'Arms', 'Barbell', 'Primary', 'Elbows still, curl the bar, no back-swing.'),
  ('Concentration Curl', 'Arms', 'Dumbbell', 'Accessory', 'Elbow braced on the thigh, peak squeeze.'),
  ('Cable Curl', 'Arms', 'Cable', 'Accessory', 'Constant tension, wrists neutral, slow negative.'),
  ('Tricep Dips', 'Arms', 'Bodyweight', 'Primary', 'Lean slightly forward, elbows back, full depth.'),
  ('Close-Grip Bench', 'Arms', 'Barbell', 'Primary', 'Shoulder-width grip, elbows tucked, press straight.'),
  ('Skull Crushers', 'Arms', 'Barbell', 'Accessory', 'Lower to the forehead, elbows fixed, extend fully.'),
  -- Core
  ('Plank', 'Core', 'Bodyweight', 'Accessory', 'Straight line head to heels, brace, breathe.'),
  ('Hanging Leg Raise', 'Core', 'Bodyweight', 'Accessory', 'No swing; curl the pelvis up, lower slowly.'),
  ('Cable Crunch', 'Core', 'Cable', 'Accessory', 'Round the spine down, pull with the abs not the arms.')
on conflict (name) where (user_id is null) do nothing;
