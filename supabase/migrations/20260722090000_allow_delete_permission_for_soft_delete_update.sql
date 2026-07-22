-- Soft delete now goes through UPDATE (setting deleted_at) instead of DELETE.
-- The *_update_custom_roles policies only checked edit_* permission, so a
-- custom-role/direct-permission user who was granted delete_* (but not
-- edit_*) got "new row violates row-level security policy" when trying to
-- soft-delete a lead/affiliate/advertiser. Extend each UPDATE policy to also
-- allow users holding the matching delete_* permission.

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
