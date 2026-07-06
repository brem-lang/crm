-- Corrective fix for 20260707000000_fix_leads_affiliates_advertisers_rls.sql,
-- which partially failed to apply:
--
-- 1. user_permissions' column is named `permission` (a `user_permission`
--    enum), not `permission_key` (that name only exists on
--    role_permission_mappings, a plain-text column). Every policy that
--    referenced user_permissions.permission_key failed with
--    "column does not exist" and was never created.
-- 2. The `user_permission` enum only ever contained its original 6 values
--    (view_phone, view_email, export_leads, delete_leads, edit_leads,
--    view_all_leads) — none of the newer permission keys used elsewhere in
--    the app (role_permission_mappings, the frontend catalog) were ever
--    added to it, so referencing them against user_permissions.permission
--    would also fail with "invalid input value for enum".
--
-- This file is idempotent: safe to re-run, and safe on top of the partial
-- state left by the previous migration (DROP POLICY IF EXISTS before each
-- CREATE POLICY).

-- === Extend the enum with every value these policies need ===
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'view_leads';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'view_affiliates';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'view_advertisers';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'create_affiliates';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'edit_affiliates';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'delete_affiliates';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'create_advertisers';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'edit_advertisers';
ALTER TYPE public.user_permission ADD VALUE IF NOT EXISTS 'delete_advertisers';

-- === affiliates ===

DROP POLICY IF EXISTS "affiliates_select_custom_roles" ON public.affiliates;
CREATE POLICY "affiliates_select_custom_roles"
ON public.affiliates FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'view_affiliates'
  )
);

DROP POLICY IF EXISTS "affiliates_select_direct_permission" ON public.affiliates;
CREATE POLICY "affiliates_select_direct_permission"
ON public.affiliates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = 'view_affiliates'
  )
);

DROP POLICY IF EXISTS "affiliates_insert_custom_roles" ON public.affiliates;
CREATE POLICY "affiliates_insert_custom_roles"
ON public.affiliates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'create_affiliates'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = 'create_affiliates'
  )
);

DROP POLICY IF EXISTS "affiliates_update_custom_roles" ON public.affiliates;
CREATE POLICY "affiliates_update_custom_roles"
ON public.affiliates FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'edit_affiliates'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = 'edit_affiliates'
  )
);

DROP POLICY IF EXISTS "affiliates_delete_custom_roles" ON public.affiliates;
CREATE POLICY "affiliates_delete_custom_roles"
ON public.affiliates FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'delete_affiliates'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = 'delete_affiliates'
  )
);

-- === advertisers ===

DROP POLICY IF EXISTS "advertisers_select_custom_roles" ON public.advertisers;
CREATE POLICY "advertisers_select_custom_roles"
ON public.advertisers FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'view_advertisers'
  )
);

DROP POLICY IF EXISTS "advertisers_select_direct_permission" ON public.advertisers;
CREATE POLICY "advertisers_select_direct_permission"
ON public.advertisers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = 'view_advertisers'
  )
);

DROP POLICY IF EXISTS "advertisers_insert_custom_roles" ON public.advertisers;
CREATE POLICY "advertisers_insert_custom_roles"
ON public.advertisers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'create_advertisers'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = 'create_advertisers'
  )
);

DROP POLICY IF EXISTS "advertisers_update_custom_roles" ON public.advertisers;
CREATE POLICY "advertisers_update_custom_roles"
ON public.advertisers FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'edit_advertisers'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = 'edit_advertisers'
  )
);

DROP POLICY IF EXISTS "advertisers_delete_custom_roles" ON public.advertisers;
CREATE POLICY "advertisers_delete_custom_roles"
ON public.advertisers FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'delete_advertisers'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = 'delete_advertisers'
  )
);

-- === leads ===

DROP POLICY IF EXISTS "leads_select_direct_permission" ON public.leads;
CREATE POLICY "leads_select_direct_permission"
ON public.leads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = 'view_leads'
  )
);

DROP POLICY IF EXISTS "leads_update_custom_roles" ON public.leads;
CREATE POLICY "leads_update_custom_roles"
ON public.leads FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'edit_leads'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = 'edit_leads'
  )
);

DROP POLICY IF EXISTS "leads_delete_custom_roles" ON public.leads;
CREATE POLICY "leads_delete_custom_roles"
ON public.leads FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'delete_leads'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission = 'delete_leads'
  )
);
