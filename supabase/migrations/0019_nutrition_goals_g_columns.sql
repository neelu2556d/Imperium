-- The app reads/writes protein_g / fat_g / carbs_g, but the original schema
-- created bare protein / fat / carbs columns. Rename them (guarded so this is
-- safe to re-run or run against a DB that's already correct).
do $$
begin
  if exists (select from information_schema.columns
             where table_schema = 'public' and table_name = 'nutrition_goals'
               and column_name = 'protein')
     and not exists (select from information_schema.columns
             where table_schema = 'public' and table_name = 'nutrition_goals'
               and column_name = 'protein_g') then
    alter table public.nutrition_goals rename column protein to protein_g;
  end if;

  if exists (select from information_schema.columns
             where table_schema = 'public' and table_name = 'nutrition_goals'
               and column_name = 'fat')
     and not exists (select from information_schema.columns
             where table_schema = 'public' and table_name = 'nutrition_goals'
               and column_name = 'fat_g') then
    alter table public.nutrition_goals rename column fat to fat_g;
  end if;

  if exists (select from information_schema.columns
             where table_schema = 'public' and table_name = 'nutrition_goals'
               and column_name = 'carbs')
     and not exists (select from information_schema.columns
             where table_schema = 'public' and table_name = 'nutrition_goals'
               and column_name = 'carbs_g') then
    alter table public.nutrition_goals rename column carbs to carbs_g;
  end if;
end $$;

-- Make sure the columns exist even on a DB where the table predates them.
alter table public.nutrition_goals
  add column if not exists protein_g numeric not null default 110,
  add column if not exists fat_g numeric not null default 73,
  add column if not exists carbs_g numeric not null default 275;

-- Ask PostgREST to reload its schema cache so the new names are visible
-- immediately (Supabase otherwise picks this up lazily).
notify pgrst, 'reload schema';
