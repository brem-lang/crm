-- Revert soft delete entirely: restore original SELECT/UPDATE policies and
-- drop the deleted_at columns. Leads/affiliates/advertisers go back to
-- being hard-deleted.

ALTER POLICY "Admins and managers can view affiliates" ON public.affiliates
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()));
ALTER POLICY "affiliates_select_custom_roles" ON public.affiliates
  USING (EXISTS (
    SELECT 1 FROM user_custom_roles ucr
    JOIN roles r ON r.id = ucr.role_id
    JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'view_affiliates'
  ));
ALTER POLICY "affiliates_select_direct_permission" ON public.affiliates
  USING (EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'view_affiliates'
  ));
ALTER POLICY "affiliates_update_custom_roles" ON public.affiliates
  USING (
    (EXISTS (
      SELECT 1 FROM user_custom_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'edit_affiliates'
    ))
    OR (EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'edit_affiliates'
    ))
  );

ALTER POLICY "Staff can view advertisers" ON public.advertisers
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()) OR is_agent(auth.uid()));
ALTER POLICY "advertisers_select_custom_roles" ON public.advertisers
  USING (EXISTS (
    SELECT 1 FROM user_custom_roles ucr
    JOIN roles r ON r.id = ucr.role_id
    JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'view_advertisers'
  ));
ALTER POLICY "advertisers_select_direct_permission" ON public.advertisers
  USING (EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'view_advertisers'
  ));
ALTER POLICY "advertisers_update_custom_roles" ON public.advertisers
  USING (
    (EXISTS (
      SELECT 1 FROM user_custom_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'edit_advertisers'
    ))
    OR (EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'edit_advertisers'
    ))
  );

ALTER POLICY "Staff can view leads" ON public.leads
  USING (is_super_admin(auth.uid()) OR is_manager(auth.uid()) OR (is_agent(auth.uid()) AND assigned_to = auth.uid()));
ALTER POLICY "leads_select_affiliate_manager" ON public.leads
  USING (EXISTS (
    SELECT 1 FROM user_affiliate_assignments uaa
    WHERE uaa.user_id = auth.uid() AND uaa.affiliate_id = leads.affiliate_id
  ));
ALTER POLICY "leads_select_custom_roles" ON public.leads
  USING (EXISTS (
    SELECT 1 FROM user_custom_roles ucr
    JOIN roles r ON r.id = ucr.role_id
    JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'view_leads'
  ));
ALTER POLICY "leads_select_direct_permission" ON public.leads
  USING (EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'view_leads'
  ));
ALTER POLICY "leads_update_custom_roles" ON public.leads
  USING (
    (EXISTS (
      SELECT 1 FROM user_custom_roles ucr
      JOIN roles r ON r.id = ucr.role_id
      JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'edit_leads'
    ))
    OR (EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'edit_leads'
    ))
  );

ALTER TABLE public.leads       DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.affiliates  DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.advertisers DROP COLUMN IF EXISTS deleted_at;
