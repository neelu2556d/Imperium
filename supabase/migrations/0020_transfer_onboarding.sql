-- Transfers an onboarding row from a previous (anonymous) user to the current
-- authenticated user. Called after email-only sign-in when the real user has no
-- onboarding row but a completed one exists under the anonymous session.
-- Runs as SECURITY DEFINER so it can update across user_ids despite RLS.

create or replace function public.transfer_onboarding(p_anon_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Move the onboarding row from the anonymous user to the current user.
  -- Only transfers if the source row exists and the target doesn't.
  update user_onboarding
     set user_id = auth.uid(),
         updated_at = now()
   where user_id = p_anon_user_id
     and not exists (
       select 1 from user_onboarding where user_id = auth.uid()
     );
end;
$$;
