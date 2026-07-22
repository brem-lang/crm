-- Soft-deleting a lead/affiliate/advertiser via a plain .update() hits a
-- well-known Postgres RLS gotcha: for UPDATE, Postgres also requires the
-- RESULTING row to pass at least one SELECT policy (in addition to the
-- UPDATE policy's own WITH CHECK) — this is true even with an explicit
-- WITH CHECK on the UPDATE policy. Since every SELECT policy on these
-- tables requires deleted_at IS NULL, setting deleted_at to a non-null
-- value makes the new row fail every SELECT policy, so the UPDATE is
-- rejected with "new row violates row-level security policy" no matter
-- how the UPDATE policies are written.
--
-- Fix: route the soft-delete through a SECURITY DEFINER RPC function that
-- checks the same permission logic explicitly, then performs the update
-- as the function owner (bypassing RLS for this specific write).

CREATE OR REPLACE FUNCTION public.soft_delete_leads(_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF is_super_admin(auth.uid()) OR is_manager(auth.uid())
     OR EXISTS (
       SELECT 1 FROM user_custom_roles ucr
       JOIN roles r ON r.id = ucr.role_id
       JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
       WHERE ucr.user_id = auth.uid() AND rpm.permission_key IN ('edit_leads', 'delete_leads')
     )
     OR EXISTS (
       SELECT 1 FROM user_permissions
       WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission IN ('edit_leads', 'delete_leads')
     )
  THEN
    UPDATE public.leads SET deleted_at = now() WHERE id = ANY(_ids);
  ELSIF is_agent(auth.uid()) THEN
    UPDATE public.leads SET deleted_at = now() WHERE id = ANY(_ids) AND assigned_to = auth.uid();
  ELSE
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_leads(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.soft_delete_leads(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_lead(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.soft_delete_leads(ARRAY[_id]);
$$;

REVOKE ALL ON FUNCTION public.soft_delete_lead(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.soft_delete_lead(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_affiliate(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    is_super_admin(auth.uid()) OR is_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_custom_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid() AND rpm.permission_key IN ('edit_affiliates', 'delete_affiliates')
    )
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission IN ('edit_affiliates', 'delete_affiliates')
    )
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  UPDATE public.affiliates SET deleted_at = now() WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_affiliate(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.soft_delete_affiliate(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_advertiser(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    is_super_admin(auth.uid()) OR is_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_custom_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid() AND rpm.permission_key IN ('edit_advertisers', 'delete_advertisers')
    )
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission IN ('edit_advertisers', 'delete_advertisers')
    )
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  UPDATE public.advertisers SET deleted_at = now() WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_advertiser(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.soft_delete_advertiser(uuid) TO authenticated;
