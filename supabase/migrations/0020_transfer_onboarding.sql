-- Transfers an onboarding row from a previous (anonymous) user to the current
-- authenticated user. Called after email-only sign-in when the real user has no
-- onboarding row but a completed one exists under the anonymous session.
-- Runs as SECURITY DEFINER so it can read across user_ids despite RLS.

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

  -- Transfer the onboarding row to the current authenticated user.
  update user_onboarding
     set user_id = auth.uid(),
         updated_at = now()
   where user_id = anon_uid;
end;
$$;
