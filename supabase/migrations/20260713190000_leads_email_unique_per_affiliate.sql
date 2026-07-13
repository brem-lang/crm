-- Relax email uniqueness on leads from global to per-affiliate, so the
-- same person's data can exist as separate leads under different
-- affiliates (needed for the Resend-as-new-lead flow), while still
-- blocking a single affiliate from submitting a duplicate lead.
DROP INDEX IF EXISTS idx_leads_email_unique;
CREATE UNIQUE INDEX idx_leads_affiliate_email_unique ON public.leads (affiliate_id, lower(email));

-- Leads had no custom-role INSERT policy (only is_super_admin/is_manager),
-- unlike SELECT/UPDATE/DELETE which already support custom roles via
-- role_permission_mappings. Add one so a custom-role user holding
-- edit_leads can create the cloned lead row for a resend.
CREATE POLICY "leads_insert_custom_roles" ON public.leads FOR INSERT
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM user_custom_roles ucr
    JOIN roles r ON r.id = ucr.role_id
    JOIN role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid() AND rpm.permission_key = 'edit_leads'
  ))
  OR
  (EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_permissions.user_id = auth.uid() AND user_permissions.permission = 'edit_leads'
  ))
);
