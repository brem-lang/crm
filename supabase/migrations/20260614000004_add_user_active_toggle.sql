-- Add is_active column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- RPC to toggle user active state (SECURITY DEFINER so it can write to auth.users)
CREATE OR REPLACE FUNCTION public.set_user_active(
  _target_user_id UUID,
  _active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super admins may call this
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can toggle user active state';
  END IF;

  -- Prevent deactivating yourself
  IF _target_user_id = auth.uid() AND NOT _active THEN
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;

  -- Update profiles flag
  UPDATE public.profiles
    SET is_active = _active
    WHERE id = _target_user_id;

  -- Block / unblock login via auth.users.banned_until
  IF _active THEN
    UPDATE auth.users
      SET banned_until = NULL
      WHERE id = _target_user_id;
  ELSE
    UPDATE auth.users
      SET banned_until = '2099-01-01 00:00:00+00'
      WHERE id = _target_user_id;
  END IF;
END;
$$;

-- Grant execute to authenticated users (RLS enforced inside the function)
GRANT EXECUTE ON FUNCTION public.set_user_active(UUID, BOOLEAN) TO authenticated;
