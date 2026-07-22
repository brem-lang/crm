-- Soft delete for leads/affiliates/advertisers, integrated with the
-- updated_at-based incremental sync (get-all-leads/affiliates/advertisers).
-- Deleting a row now sets deleted_at instead of removing it; the existing
-- update_updated_at_column() trigger already bumps updated_at on any
-- UPDATE, so a soft-delete is picked up by the same since= sync pull that
-- already detects other field changes, with no separate deletion-listing
-- endpoint needed.

ALTER TABLE public.leads       ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.affiliates  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.advertisers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- SELECT policies: hide soft-deleted rows from every RLS-subject frontend
-- query (all user-facing list/detail pages), with zero UI code changes.

ALTER POLICY "Admins and managers can view affiliates" ON public.affiliates
  USING ((is_super_admin(auth.uid()) OR is_manager(auth.uid())) AND deleted_at IS NULL);
ALTER POLICY "affiliates_select_custom_roles" ON public.affiliates
  USING ((EXISTS (
    SELECT 1 FROM user_custom_roles ucr
    JOIN roles r ON r.id = ucr.role_id
    JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'view_affiliates'
  )) AND deleted_at IS NULL);
ALTER POLICY "affiliates_select_direct_permission" ON public.affiliates
  USING ((EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'view_affiliates'
  )) AND deleted_at IS NULL);

ALTER POLICY "Staff can view advertisers" ON public.advertisers
  USING ((is_super_admin(auth.uid()) OR is_manager(auth.uid()) OR is_agent(auth.uid())) AND deleted_at IS NULL);
ALTER POLICY "advertisers_select_custom_roles" ON public.advertisers
  USING ((EXISTS (
    SELECT 1 FROM user_custom_roles ucr
    JOIN roles r ON r.id = ucr.role_id
    JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'view_advertisers'
  )) AND deleted_at IS NULL);
ALTER POLICY "advertisers_select_direct_permission" ON public.advertisers
  USING ((EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'view_advertisers'
  )) AND deleted_at IS NULL);

ALTER POLICY "Staff can view leads" ON public.leads
  USING ((is_super_admin(auth.uid()) OR is_manager(auth.uid()) OR (is_agent(auth.uid()) AND assigned_to = auth.uid())) AND deleted_at IS NULL);
ALTER POLICY "leads_select_affiliate_manager" ON public.leads
  USING ((EXISTS (
    SELECT 1 FROM user_affiliate_assignments uaa
    WHERE uaa.user_id = auth.uid() AND uaa.affiliate_id = leads.affiliate_id
  )) AND deleted_at IS NULL);
ALTER POLICY "leads_select_custom_roles" ON public.leads
  USING ((EXISTS (
    SELECT 1 FROM user_custom_roles ucr
    JOIN roles r ON r.id = ucr.role_id
    JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'view_leads'
  )) AND deleted_at IS NULL);
ALTER POLICY "leads_select_direct_permission" ON public.leads
  USING ((EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'view_leads'
  )) AND deleted_at IS NULL);

-- UPDATE policies: allow delete_* permission holders (not just edit_*) to
-- perform the soft-delete update — this is the gap that broke soft-delete
-- for delete-only custom roles last time, fixed up front this time.

ALTER POLICY "leads_update_custom_roles" ON public.leads
  USING (
    (EXISTS (
      SELECT 1 FROM user_custom_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid() AND rpm.permission_key IN ('edit_leads', 'delete_leads')
    ))
    OR (EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
        AND user_permissions.permission IN ('edit_leads', 'delete_leads')
    ))
  );

ALTER POLICY "affiliates_update_custom_roles" ON public.affiliates
  USING (
    (EXISTS (
      SELECT 1 FROM user_custom_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid() AND rpm.permission_key IN ('edit_affiliates', 'delete_affiliates')
    ))
    OR (EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
        AND user_permissions.permission IN ('edit_affiliates', 'delete_affiliates')
    ))
  );

ALTER POLICY "advertisers_update_custom_roles" ON public.advertisers
  USING (
    (EXISTS (
      SELECT 1 FROM user_custom_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid() AND rpm.permission_key IN ('edit_advertisers', 'delete_advertisers')
    ))
    OR (EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
        AND user_permissions.permission IN ('edit_advertisers', 'delete_advertisers')
    ))
  );
