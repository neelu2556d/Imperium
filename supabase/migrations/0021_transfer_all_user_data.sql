-- Transfers ALL user data from a previous (anonymous) user to the current
-- authenticated user. This is the comprehensive version of transfer_onboarding
-- that also moves training splits, exercises, logs, and other user data.
-- Runs as SECURITY DEFINER so it can access auth.users and cross user_ids.

create or replace function public.transfer_all_user_data(p_email text)
returns void
language plpgsql
security definer
as $$
declare
  anon_uid uuid;
  new_uid uuid;
begin
  -- Find the anonymous user who claimed this email.
  select id into anon_uid
    from auth.users
   where is_anonymous = true
     and (user_metadata ->> 'claimed_email') = p_email
   limit 1;

  if anon_uid is null then
    return;
  end if;

  new_uid := auth.uid();

  -- Only transfer if the current user doesn't already have data.
  -- Check training_split as the primary indicator of existing data.
  if exists (select 1 from training_split where user_id = new_uid) then
    return;
  end if;

  -- Transfer training_split rows
  update training_split
     set user_id = new_uid,
         created_at = now()
   where user_id = anon_uid;

  -- Transfer day_exercises rows (foreign key to training_split is preserved)
  update day_exercises
     set user_id = new_uid,
         created_at = now()
   where user_id = anon_uid;

  -- Transfer set_logs rows
  update set_logs
     set user_id = new_uid,
         created_at = now()
   where user_id = anon_uid;

  -- Transfer session_completions rows
  update session_completions
     set user_id = new_uid,
         created_at = now()
   where user_id = anon_uid;

  -- Transfer food_logs rows
  update food_logs
     set user_id = new_uid,
         created_at = now()
   where user_id = anon_uid;

  -- Transfer sleep_logs rows
  update sleep_logs
     set user_id = new_uid,
         created_at = now()
   where user_id = anon_uid;

  -- Transfer water_logs rows
  update water_logs
     set user_id = new_uid,
         created_at = now()
   where user_id = anon_uid;

  -- Transfer body_weight_logs rows
  update body_weight_logs
     set user_id = new_uid,
         created_at = now()
   where user_id = anon_uid;

  -- Transfer progress_photos rows
  update progress_photos
     set user_id = new_uid,
         created_at = now()
   where user_id = anon_uid;

  -- Transfer mentor_messages rows
  update mentor_messages
     set user_id = new_uid,
         created_at = now()
   where user_id = anon_uid;

  -- Transfer user_profiles rows
  update user_profiles
     set user_id = new_uid,
         created_at = now()
   where user_id = anon_uid;

  -- Transfer nutrition_goals rows
  update nutrition_goals
     set user_id = new_uid,
         updated_at = now()
   where user_id = anon_uid;

  -- Transfer user_onboarding row
  update user_onboarding
     set user_id = new_uid,
         updated_at = now()
   where user_id = anon_uid;

  -- Delete the anonymous user's data to avoid duplicates
  -- (training_split cascade will handle day_exercises and session_completions)
  delete from training_split where user_id = anon_uid;
  delete from set_logs where user_id = anon_uid;
  delete from food_logs where user_id = anon_uid;
  delete from sleep_logs where user_id = anon_uid;
  delete from water_logs where user_id = anon_uid;
  delete from body_weight_logs where user_id = anon_uid;
  delete from progress_photos where user_id = anon_uid;
  delete from mentor_messages where user_id = anon_uid;
  delete from user_profiles where user_id = anon_uid;
  delete from nutrition_goals where user_id = anon_uid;
  delete from user_onboarding where user_id = anon_uid;

end;
$$;
