-- Allow set_user_roles to accept an empty array.
-- This is needed when assigning a custom role (e.g. affiliate_manager):
-- we clear system roles by passing [] and then set the custom role separately.

CREATE OR REPLACE FUNCTION public.set_user_roles(_target_user_id uuid, _roles public.app_role[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid;
BEGIN
  _caller := auth.uid();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_super_admin(_caller) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Safety: prevent a super admin from removing their own super_admin role
  IF _target_user_id = _caller AND NOT ('super_admin' = ANY(_roles)) THEN
    RAISE EXCEPTION 'You cannot remove your own super_admin role';
  END IF;

  -- Replace roles atomically (empty array = clear all system roles, custom role set separately)
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;

  IF _roles IS NOT NULL AND array_length(_roles, 1) > 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT _target_user_id, r
    FROM unnest(_roles) AS r;
  END IF;
END;
$$;
