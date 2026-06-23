-- Safety migration: ensure audit_logs SELECT policies are correct.
-- Drop both old and new names then recreate cleanly so a partial
-- apply of 20260625000002 cannot leave the table with no SELECT policy.

DROP POLICY IF EXISTS "audit_logs_select_super_admin"  ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_authorized"   ON public.audit_logs;

-- Super admins can read everything (simple, fast)
CREATE POLICY "audit_logs_select_super_admin" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Manager role
CREATE POLICY "audit_logs_select_manager" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'manager'
    )
  );

-- Users with view_audit_logs via custom role
CREATE POLICY "audit_logs_select_permission" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.user_custom_roles ucr
      JOIN public.roles r ON r.id = ucr.role_id
      JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
      WHERE ucr.user_id = auth.uid()
        AND rpm.permission_key = 'view_audit_logs'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND permission = 'view_audit_logs'
    )
  );
