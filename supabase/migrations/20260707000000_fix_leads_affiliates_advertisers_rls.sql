-- Fix: leads/affiliates/advertisers SELECT (and write) policies only covered
-- system roles (is_super_admin/is_manager/is_agent, which read user_roles).
-- Custom roles (e.g. "Admin", assigned via user_custom_roles) got completely
-- empty pages and failed writes, even with full permissions in
-- role_permission_mappings — the same bug already fixed for lead_distributions
-- in 20260627000000_fix_lead_distributions_rls.sql, extended here to the
-- three base tables it was never applied to.
--
-- Additive only: existing system-role policies are untouched. Postgres RLS
-- ORs multiple permissive policies together, so this only adds access, never
-- removes any.

-- === Seed the new view_* permissions ===
-- view_leads/view_affiliates/view_advertisers are new manageable permissions
-- (added to AVAILABLE_PERMISSIONS in src/hooks/useUserPermissions.ts).
-- Grant them to super_admin (for catalog completeness — super_admin bypasses
-- RLS via is_super_admin() regardless) and to any existing role that already
-- holds a related manage permission, so nobody who could already manage a
-- resource loses the ability to see it.
INSERT INTO public.role_permission_mappings (role_slug, permission_key)
SELECT DISTINCT role_slug, 'view_leads'
FROM public.role_permission_mappings
WHERE role_slug = 'super_admin' OR permission_key IN ('edit_leads', 'delete_leads')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permission_mappings (role_slug, permission_key)
SELECT DISTINCT role_slug, 'view_affiliates'
FROM public.role_permission_mappings
WHERE role_slug = 'super_admin' OR permission_key IN ('create_affiliates', 'edit_affiliates', 'delete_affiliates')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permission_mappings (role_slug, permission_key)
SELECT DISTINCT role_slug, 'view_advertisers'
FROM public.role_permission_mappings
WHERE role_slug = 'super_admin' OR permission_key IN ('create_advertisers', 'edit_advertisers', 'delete_advertisers')
ON CONFLICT DO NOTHING;

-- 'admin' custom role copied super_admin's permissions at creation time
-- (20260624000000_add_admin_role.sql), before these keys existed — seed it
-- directly so it doesn't need to wait on that copy running again.
INSERT INTO public.role_permission_mappings (role_slug, permission_key)
VALUES
  ('admin', 'view_leads'),
  ('admin', 'view_affiliates'),
  ('admin', 'view_advertisers')
ON CONFLICT DO NOTHING;

-- === affiliates ===

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

CREATE POLICY "affiliates_select_direct_permission"
ON public.affiliates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission_key = 'view_affiliates'
  )
);

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
    WHERE user_id = auth.uid() AND permission_key = 'create_affiliates'
  )
);

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
    WHERE user_id = auth.uid() AND permission_key = 'edit_affiliates'
  )
);

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
    WHERE user_id = auth.uid() AND permission_key = 'delete_affiliates'
  )
);

-- === advertisers ===

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

CREATE POLICY "advertisers_select_direct_permission"
ON public.advertisers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission_key = 'view_advertisers'
  )
);

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
    WHERE user_id = auth.uid() AND permission_key = 'create_advertisers'
  )
);

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
    WHERE user_id = auth.uid() AND permission_key = 'edit_advertisers'
  )
);

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
    WHERE user_id = auth.uid() AND permission_key = 'delete_advertisers'
  )
);

-- === leads ===

CREATE POLICY "leads_select_custom_roles"
ON public.leads FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'view_leads'
  )
);

CREATE POLICY "leads_select_direct_permission"
ON public.leads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND permission_key = 'view_leads'
  )
);

-- Affiliate managers: can see leads from their assigned affiliates
CREATE POLICY "leads_select_affiliate_manager"
ON public.leads FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_affiliate_assignments uaa
    WHERE uaa.user_id = auth.uid()
      AND uaa.affiliate_id = leads.affiliate_id
  )
);

-- Advertiser managers: can see leads distributed to their assigned advertisers
CREATE POLICY "leads_select_advertiser_manager"
ON public.leads FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.lead_distributions ld
    JOIN public.user_advertiser_assignments uaa ON uaa.advertiser_id = ld.advertiser_id
    WHERE ld.lead_id = leads.id
      AND uaa.user_id = auth.uid()
  )
);

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
    WHERE user_id = auth.uid() AND permission_key = 'edit_leads'
  )
);

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
    WHERE user_id = auth.uid() AND permission_key = 'delete_leads'
  )
);
