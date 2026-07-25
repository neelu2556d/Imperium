-- Transfers an onboarding row from a previous (anonymous) user to the current
-- authenticated user. Looks up the anonymous user by claimed_email in metadata.
-- Runs as SECURITY DEFINER so it can access auth.users and cross user_ids
-- despite RLS on user_onboarding.

create or replace function public.transfer_onboarding(p_email text)
returns void
language plpgsql
security definer
as $$
declare
  anon_uid uuid;
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

  -- Only transfer if the current user doesn't already have a row.
  if exists (select 1 from user_onboarding where user_id = auth.uid()) then
    return;
  end if;

  -- Move the onboarding row to the current user.
  update user_onboarding
     set user_id = auth.uid(),
         updated_at = now()
   where user_id = anon_uid;
end;
$$;
