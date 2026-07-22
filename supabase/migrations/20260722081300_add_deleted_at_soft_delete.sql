-- Soft delete: leads/affiliates/advertisers deletes become recoverable
-- instead of destructive. deleted_at is nullable; every existing SELECT
-- policy is extended to exclude soft-deleted rows so the entire frontend
-- (which only ever queries through RLS, never a service-role client)
-- automatically stops seeing them with no application code changes.

ALTER TABLE public.leads       ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.affiliates  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.advertisers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- affiliates
ALTER POLICY "Admins and managers can view affiliates" ON public.affiliates
  USING ((is_super_admin(auth.uid()) OR is_manager(auth.uid())) AND deleted_at IS NULL);

ALTER POLICY "affiliates_select_custom_roles" ON public.affiliates
  USING (
    (EXISTS (
      SELECT 1 FROM user_custom_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'view_affiliates'
    )) AND deleted_at IS NULL
  );

ALTER POLICY "affiliates_select_direct_permission" ON public.affiliates
  USING (
    (EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'view_affiliates'
    )) AND deleted_at IS NULL
  );

-- advertisers
ALTER POLICY "Staff can view advertisers" ON public.advertisers
  USING ((is_super_admin(auth.uid()) OR is_manager(auth.uid()) OR is_agent(auth.uid())) AND deleted_at IS NULL);

ALTER POLICY "advertisers_select_custom_roles" ON public.advertisers
  USING (
    (EXISTS (
      SELECT 1 FROM user_custom_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'view_advertisers'
    )) AND deleted_at IS NULL
  );

ALTER POLICY "advertisers_select_direct_permission" ON public.advertisers
  USING (
    (EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'view_advertisers'
    )) AND deleted_at IS NULL
  );

-- leads
ALTER POLICY "Staff can view leads" ON public.leads
  USING ((is_super_admin(auth.uid()) OR is_manager(auth.uid()) OR (is_agent(auth.uid()) AND assigned_to = auth.uid())) AND deleted_at IS NULL);

ALTER POLICY "leads_select_affiliate_manager" ON public.leads
  USING (
    (EXISTS (
      SELECT 1 FROM user_affiliate_assignments uaa
      WHERE uaa.user_id = auth.uid() AND uaa.affiliate_id = leads.affiliate_id
    )) AND deleted_at IS NULL
  );

ALTER POLICY "leads_select_custom_roles" ON public.leads
  USING (
    (EXISTS (
      SELECT 1 FROM user_custom_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'view_leads'
    )) AND deleted_at IS NULL
  );

ALTER POLICY "leads_select_direct_permission" ON public.leads
  USING (
    (EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'view_leads'
    )) AND deleted_at IS NULL
  );
